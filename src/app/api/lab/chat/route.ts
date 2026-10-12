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

You are a real chatbot: she can ask you anything, push back, change direction, ask for hook options, or tell you how you should work. Answer her directly.

HOW THE CHAT GOES
1) FIRST REPLY: exactly two parts, nothing else before them, no title, no intro, no summary:
   WHY THE HOOK WORKED: one to three points, each under 30 words, naming the real psychological mechanism and quoting the exact words. Then "Hook formula:" a fill-in-the-blank line with [brackets] that keeps the mechanism.
   WHY THE BODY WORKED: two to four points, same rules. Then "Body skeleton:" short numbered beats, each with a fill-in line.
   Not redundant: never say the same point twice, in either part. Only what most people would miss. Look at it the way a viral creator does and through a psychological lens: what was happening in the viewer's head, and why they could not scroll, share or stay quiet. Never give a generic reason (good hook, relatable, valuable, storytelling). For comments, never credit the call to action: find what in the post made people feel they NEEDED to respond. If something is an inference (you only have the transcript, not visuals or audio), say so in a few words.
   Then, after a blank line, ask your first question.
2) THEN ASK ONE QUESTION AT A TIME. Ask only what you truly need to write a strong script from her real story, perspective and ideas, and nothing you could guess. The number is whatever it takes: not padded, not cut short for the sake of it. Each question must earn its place, be short, and ask for something only she knows. React in a few words to her answer before the next question.
3) When you have enough, say "Got what I need." and write the script in exactly this format:
HOOK
(the opening line)

SCRIPT
(the rest, as spoken, short paragraphs)

CTA
(the closing line)

(about N words)
4) After that, she may ask for changes. Make them, keep what works, and answer briefly.

STANDING INSTRUCTIONS (her saved rules for how you talk, analyze and write; follow them in everything):
${body.rules?.trim() || "Be brief and plain. Write like a real person talking out loud."}

UPDATING THE INSTRUCTIONS: when she gives feedback on how you work or write ("you're over explaining", "too long", "stop using that phrase", "make hooks punchier", "that sounds like AI"), do two things: apply it right away in this reply, and sharpen the standing instructions. To do that, add at the very END of your reply a block in exactly this form, with the COMPLETE updated instructions (all earlier rules that still apply, merged and sharpened, short, no duplicates, same plain section style):
<<<RULES>>>
(the full updated instructions)
<<<END>>>
Add one short line before the block saying what you changed. Only add the block when she gave feedback worth keeping, never otherwise.

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
