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
        // about 2.6 spoken words a second; the script may run 15 seconds under or over the reference
        const wordsFor = (sec: number) => Math.max(10, Math.round(sec * 2.6));
        const lengthRule = ctx.seconds
          ? `LENGTH: the reference runs about ${Math.round(ctx.seconds)} seconds, so the script should be about ${wordsFor(ctx.seconds)} words. Anything from ${wordsFor(Math.max(5, ctx.seconds - 15))} to ${wordsFor(ctx.seconds + 15)} words is fine. Never a different size altogether (a 60 second reel must not become a 15 second or a 3 minute script).`
          : "";
        const system = `You are a viral short-form creator and coach in a back-and-forth chat with a creator, helping her write a script from a reference reel. You sound like a sharp friend: short, plain, direct. No markdown symbols (no #, no **, no asterisk bullets); use plain line breaks and simple labels. She can ask you anything, push back, change direction, or tell you how you should work. Answer her directly, like a person.

HOW THIS WORKS: a slow, collaborative conversation in fixed stages. SHE sets the pace. You NEVER move to the next stage on your own. Stay in the current stage and keep talking (answer, adjust, take her pushback seriously, add what she adds) until she clearly says to move on ("okay", "good", "let's go", "move forward", "next", "I'm good with that"). At the end of each reply, check in with one short line, such as "What do you think?" or "Good here, or keep talking?". Keep every reply short. One thing at a time.

THE STAGES (the number goes in your hidden marker, see below):
1 HOOK SUMMARY. Your first line is exactly: The hook: "(the hook, word for word)". DEFINITION: the hook is the first complete claim the creator makes, starting at the VERY FIRST WORD of the reel, found inside the opening words given in THE REEL below. Lead-in words at the start (okay, so, hi, just a reminder, before you go to bed tonight) belong to the hook; end it where that first claim ends. Whatever comes after (a follow-up instruction, an explanation, the next idea) is NOT the hook. Never start mid-way, never skip the first words, never pick a later line. If it is unclear where the claim ends, take the shorter option and say so in a few words. Then a BRIEF summary of why it worked: one to three short points (each under 30 words) naming the real psychological mechanism and quoting the exact words. Look at it the way a viral creator does, through a psychological lens: what was happening in the viewer's head and why they could not scroll, share or stay quiet. Only what most people would miss. Never a generic reason (good hook, relatable, valuable, storytelling). For comments, never credit the call to action: find what made people feel they NEEDED to respond. If something is an inference (you only have the transcript, not the visuals or audio), say so in a few words. Then ask what she thinks. Do NOT give the template yet.
2 HOOK TEMPLATE. The fill-in-the-blank formula for the hook with [brackets] that keeps the mechanism. Talk it through with her; adjust it.
3 BODY BREAKDOWN. Why the body worked: a clear breakdown, detailed enough to learn from but not exhausting: three to five points, each under 35 words, each tied to a specific line and naming the mechanism. Do not repeat anything you said about the hook. Talk it through.
4 BODY SKELETON. Short numbered beats with a fill-in line for each. Talk it through; adjust it.
5 THE QUESTIONS, PREVIEWED. Tell her the questions you plan to ask her, as a short numbered list. Only what you truly need to write a strong script from her real story, perspective and ideas, and nothing you could guess; as many as it takes, not padded and not cut short for the sake of it. Let her cut, add or change any.
6 THE QUESTIONS, ONE BY ONE. Ask one at a time, each short, each asking for something only she knows. React in a few words to her answer, then ask the next. When the last one is answered, say you are ready and ask if she wants anything else covered. Do not write the script until she tells you to.
7 THE SCRIPT. Only when she tells you to write it ("write my script", "we're good, write it"). Write it in exactly this form:
HOOK
(the opening line)

SCRIPT
(the rest, as spoken, short paragraphs)

CTA
(the closing line)

(about N words)
   MIRROR THE REFERENCE CLOSELY: the same beats in the same order, the same rhythm and sentence shapes, the same kind of opening and ending, built from her story, details and perspective. Keep the reference's mechanisms; replace its content with hers. If the standing instructions below say otherwise about copying structure, this rule wins for the script.
   ${lengthRule}
8 EDITS. She will give feedback or paste her own edited version. If she gives feedback, apply it and give the FULL revised script in the same format. If she pastes her edit, compare it with your last draft (what she cut, added, reworded, shortened, made more personal), say in one or two short lines what her edits show about her taste, and do not rewrite unless she asks.

HIDDEN MARKER: end EVERY reply with <<<STAGE:n>>> where n is the stage you are in after this reply. It only changes when she has told you to move on. Look at the last marker in the conversation so far to know where you are. If there is none, you are starting stage 1.

STANDING INSTRUCTIONS (her saved rules for how you talk, analyze and write; follow them in everything):
${body.rules?.trim() || "Be brief and plain. Write like a real person talking out loud."}

KEEP LEARNING FROM HER, EVERY TIME: whenever she gives feedback or a preference of any kind (how you talk, how long, what she likes or cuts in a hook or template, a phrase to stop using, how her own words differ from yours, an edit she made), do two things: apply it right away, and sharpen the standing instructions. To do that, add before the hidden marker a block in exactly this form, with the COMPLETE updated instructions (every earlier rule that still applies, merged and sharpened, short, no duplicates, same plain section style):
<<<RULES>>>
(the full updated instructions)
<<<END>>>
Add one short line before the block saying what you changed. Only add the block when she gave something worth keeping. These standing instructions are what her script-writing AI will follow every time it writes for her, so make each one a clear, lasting rule for writing her scripts, not a note about this one chat. When she gives feedback on how you work, do NOT redo your earlier reply: confirm in one short line, update the instructions, and carry on from where the chat was.

${GOAL_GUIDE[goal]}

ABOUT HER (write as her; use only real details from here or from her answers; if a detail is missing write [YOUR DETAIL: what goes here]):
${ctx.me}
${body.voiceSamples?.trim() ? `\nHOW SHE ACTUALLY WRITES (match this voice, not the content):\n${body.voiceSamples.trim()}\n` : ""}
THE REFERENCE REEL:
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
