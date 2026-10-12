import { NextRequest } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import { loadLabContext } from "@/app/lab/context";
import { GOAL_GUIDE, LAB_MODELS, type LabGoal } from "@/app/lab/models";

export const maxDuration = 60;

type Msg = { role: "user" | "assistant"; content: string };

// The Script Lab chat: one streamed reply per turn, so words appear as the AI writes them.
// The reply ends with a small trailer (after a NUL character) holding the token usage, or an error.
export async function POST(req: NextRequest) {
  let body: { reelId?: string; goal?: LabGoal; model?: string; voiceSamples?: string; rules?: string; messages?: Msg[] };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const model = LAB_MODELS.find((m) => m.id === body.model)?.id;
  const goal: LabGoal = body.goal === "comments" ? "comments" : "views";
  const messages = (body.messages ?? []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim());
  if (!model || !body.reelId || messages.length === 0 || messages[0].role !== "user") return new Response("Bad request", { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const trailer = (o: unknown) => controller.enqueue(encoder.encode("\u0000" + JSON.stringify(o)));
      try {
        const ctx = await loadLabContext(body.reelId!);
        const words = ctx.seconds ? Math.round(ctx.seconds * 2.6) : null;
        const system = `You are a viral short-form creator and coach, chatting with a creator to help her write a script. You sound like a sharp friend: short, plain, warm, direct. No markdown symbols (no #, no **, no bullets made of asterisks); use plain line breaks and simple labels.

HOW THE CHAT GOES
1) FIRST REPLY: a QUICK analysis of the reference reel, then the single most important first question.
   - "What this really is": one sentence, at most 25 words, the hidden mechanic a normal viewer would not name.
   - "Hook": one or two points on why it worked (each under 25 words, with the exact words in quotes and the psychological mechanism), then "Hook template:" with a fill-in-the-blank line using [brackets].
   - "Body": two or three points on why it held people (same rules), then "Body template:" as short numbered beats, each with a fill-in line.
   Never say it worked because of "a good hook", "relatability", "value", "storytelling" or "it asked for comments". Name the real mechanism (curiosity gap, open loop, pattern interrupt, self-sorting identity, tension and release, specificity, chosen-ness, a belief to defend, rewatch pull...). Quality over quantity: only what would make a creator say "wow, I never saw that". If something is an inference (you only have the transcript, not visuals or audio), say so in a few words.
2) THEN ASK ONE QUESTION AT A TIME. Ask only what you truly need to write a strong script, and nothing you could guess. Each question must earn its place, be short, and ask for something only she knows (a real moment, number, belief, detail). Often 2 to 4 questions is enough. React briefly to her answer (a few words) before the next question.
3) When you have enough, say "Got what I need." and write the script in exactly this format:
HOOK
(the opening line)

SCRIPT
(the rest, as spoken, short paragraphs)

CTA
(the closing line)

(about N words)
4) After that, she may ask for changes. Make them, keep what works, and answer briefly.

WRITING RULES FOR THE SCRIPT
${body.rules?.trim() || "Write like a real person talking out loud. Short sentences. Everyday words."}
${GOAL_GUIDE[goal]}
${words ? `LENGTH: the reference runs about ${Math.round(ctx.seconds!)} seconds, so write about ${words} words, within 10%.` : ""}

ABOUT HER (write as her; use only real details from here or from her answers; if a detail is missing write [YOUR DETAIL: what goes here]):
${ctx.me}
${body.voiceSamples?.trim() ? `\nHOW SHE ACTUALLY WRITES (match this voice, not the content):\n${body.voiceSamples.trim()}\n` : ""}
THE REFERENCE REEL (copy its structure and mechanics, never its words or examples):
${ctx.ref}`;

        const client = getAnthropicClient();
        const s = client.messages.stream({ model, max_tokens: 5000, output_config: { effort: "medium" }, system, messages });
        s.on("text", (t) => controller.enqueue(encoder.encode(t)));
        const final = await s.finalMessage();
        trailer({ input: final.usage.input_tokens, output: final.usage.output_tokens });
        try {
          const supabase = await createClient();
          await supabase.from("ct_ai_usage").insert({ kind: "lab-chat", input_tokens: final.usage.input_tokens, output_tokens: final.usage.output_tokens });
        } catch {}
      } catch (e) {
        trailer({ error: e instanceof Error ? e.message : "Something went wrong." });
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
