"use server";

import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { GOAL_GUIDE, LAB_MODELS, type LabGoal, type LabModel } from "./models";

type Usage = { input_tokens?: number; output_tokens?: number } | undefined;
export type LabRun = { usage: { input: number; output: number; cents: number; model: string } };

function costOf(model: LabModel, u: Usage) {
  const m = LAB_MODELS.find((x) => x.id === model) ?? LAB_MODELS[1];
  const input = u?.input_tokens ?? 0;
  const output = u?.output_tokens ?? 0;
  return { input, output, cents: ((input * m.inPerM + output * m.outPerM) / 1_000_000) * 100, model: m.label };
}

async function logUsage(kind: string, u: Usage) {
  try {
    const supabase = await createClient();
    await supabase.from("ct_ai_usage").insert({ kind, input_tokens: u?.input_tokens ?? 0, output_tokens: u?.output_tokens ?? 0 });
  } catch {}
}

// Everything the AI should know: who you are (Settings), and the reference reel.
async function loadContext(reelId: string) {
  const supabase = await createClient();
  const [{ data: reel }, { data: brand }, { data: foundation }] = await Promise.all([
    supabase.from("ct_reels").select("owner_username, views, comments_count, duration_seconds, hook_text, body_text, cta_text, transcript, caption, post_type").eq("id", reelId).single(),
    supabase.from("ct_brand_profile").select("headline, about, voice, known_for, story_beats").eq("id", "00000000-0000-0000-0000-000000000001").maybeSingle(),
    supabase.from("ct_brand_foundation").select("good_at, love_learning, people_need, overlap, voice, journey, for_against").eq("id", "00000000-0000-0000-0000-000000000001").maybeSingle(),
  ]);
  if (!reel) throw new Error("Couldn't find that reel.");
  let avgViews: number | null = null;
  if (reel.owner_username) {
    const { data: others } = await supabase.from("ct_reels").select("views").eq("owner_username", reel.owner_username).limit(60);
    if (others && others.length >= 2) avgViews = others.reduce((s, r) => s + ((r.views as number) ?? 0), 0) / others.length;
  }
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean).join("; ") : "");
  const me = [
    brand?.headline && `Headline: ${brand.headline}`,
    brand?.about && `About me: ${brand.about}`,
    list(brand?.voice) && `My voice: ${list(brand?.voice)}`,
    list(brand?.known_for) && `Known for: ${list(brand?.known_for)}`,
    list(brand?.story_beats) && `My story: ${list(brand?.story_beats)}`,
    foundation?.voice && `Voice notes: ${foundation.voice}`,
    foundation?.journey && `My journey: ${foundation.journey}`,
    foundation?.for_against && `What I'm for and against: ${foundation.for_against}`,
    foundation?.people_need && `What people need from me: ${foundation.people_need}`,
  ]
    .filter(Boolean)
    .join("\n");
  const ref = [
    `Creator: @${reel.owner_username ?? "unknown"}`,
    `Views: ${reel.views}${avgViews ? ` (their average is about ${Math.round(avgViews)})` : ""}. Comments: ${reel.comments_count}. Length: ${reel.duration_seconds ? Math.round(reel.duration_seconds as number) + " seconds" : "unknown"}.`,
    reel.hook_text && `Its hook: ${reel.hook_text}`,
    reel.cta_text && `Its call to action: ${reel.cta_text}`,
    `Full transcript:\n${String(reel.transcript ?? reel.caption ?? "").slice(0, 4000)}`,
  ]
    .filter(Boolean)
    .join("\n");
  const seconds = (reel.duration_seconds as number | null) ?? null;
  return { me: me || "(nothing saved in Settings yet)", ref, seconds };
}

function textOf(res: { content: { type: string; text?: string }[] }) {
  return res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

// ---------------------------------------------------------------- write a script
export async function writeScript(input: {
  reelId: string;
  goal: LabGoal;
  model: LabModel;
  idea: string;
  voiceSamples: string;
  rules: string;
  framework?: string; // from "Study this reel"
  answers?: string; // the user's answers to its questions
  tweak?: { previous: string; instruction: string }; // "shorter", "more like me", ...
}): Promise<(LabRun & { script: string }) | { error: string }> {
  try {
    const ctx = await loadContext(input.reelId);
    const system = `You write short-form video scripts that sound exactly like the person they are for. Your job is the writing itself: plain, specific and human, never "AI sounding".\n\nWRITING RULES:\n${input.rules}\n\n${GOAL_GUIDE[input.goal]}\n\nOUTPUT FORMAT, exactly:\nHOOK\n(the opening line)\n\nSCRIPT\n(the rest, as it is spoken, in short paragraphs)\n\nCTA\n(the closing line)\n\n(about N words)`;
    const parts = [
      `ABOUT ME (write as me):\n${ctx.me}`,
      input.voiceSamples.trim() && `HOW I ACTUALLY WRITE (match this voice, not the content):\n${input.voiceSamples.trim()}`,
      `THE REFERENCE REEL (copy its structure, not its words):\n${ctx.ref}`,
      ctx.seconds ? `LENGTH: the reference runs about ${Math.round(ctx.seconds)} seconds, so write about ${Math.round(ctx.seconds * 2.6)} words (spoken at a natural pace), within 10%.` : "",
      input.framework?.trim() && `THE FRAMEWORK TO FOLLOW:\n${input.framework.trim()}`,
      input.idea.trim() && `MY IDEA / WHAT THIS REEL IS ABOUT:\n${input.idea.trim()}`,
      input.answers?.trim() && `MY OWN STORY AND DETAILS (use these, they are real):\n${input.answers.trim()}`,
      input.tweak ? `HERE IS THE DRAFT:\n${input.tweak.previous}\n\nCHANGE IT LIKE THIS: ${input.tweak.instruction}\nKeep everything else that works. Same format.` : "Write the script now.",
    ].filter(Boolean);
    const res = await getAnthropicClient().messages.create({ model: input.model, max_tokens: 8000, system, messages: [{ role: "user", content: parts.join("\n\n") }] });
    await logUsage("lab-script", res.usage as Usage);
    const script = textOf(res as never);
    if (!script) return { error: `The AI used up its room thinking and wrote nothing (${res.stop_reason}). Try again, or pick a different model.` };
    return { script, usage: costOf(input.model, res.usage as Usage) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

// ---------------------------------------------------------------- study a reel
const StudySchema = z.object({
  reallyIs: z.string().describe("At most 25 words: what this reel REALLY is underneath, the hidden mechanic a normal viewer would not name."),
  hook: z.object({
    why: z.array(z.string()).describe("1 point, maybe 2: the most important non-obvious reason the hook worked. At most 25 words: the exact words in quotes, then the mechanism."),
    template: z.string().describe("A fill-in-the-blank version of the hook with [brackets] where the creator's own content goes, keeping the mechanism intact."),
  }),
  body: z.object({
    why: z.array(z.string()).describe("2 points, maybe 3: the most important non-obvious reasons the body held people. At most 25 words each: a line or moment in quotes, then the mechanism."),
    beats: z
      .array(
        z.object({
          beat: z.string().describe("Short name of the beat."),
          job: z.string().describe("What this beat does to the viewer, one short sentence."),
          template: z.string().describe("A fill-in-the-blank line for this beat with [brackets] for the creator's own content."),
        }),
      )
      .describe("The body as 3 to 5 ordered beats. Only as many as the reel really has."),
  }),
  questions: z.array(z.string()).describe("Only the questions whose answers are truly needed to write a strong script from this skeleton. There is no fixed number: as few as it takes (often 2 to 4, never padded). Each question must unlock a specific beat or detail the script cannot work without, be short, and ask for something only the creator knows (a real moment, number, belief or detail). Never ask anything you could reasonably guess."),
});
export type Study = z.infer<typeof StudySchema>;

export async function studyReel(input: { reelId: string; goal: LabGoal; model: LabModel; idea: string }): Promise<(LabRun & { study: Study }) | { error: string }> {
  try {
    const ctx = await loadContext(input.reelId);
    const system = `You are a viral short-form creator who has built several accounts into the millions and has studied thousands of reels. You look at a reel the way an insider does, through psychology: what is happening in the viewer's head second by second, and why they could not scroll, share or stay quiet.\n\nGO BEYOND THE OBVIOUS. Never say a reel worked because it had a good hook, was relatable, was valuable, was engaging, used storytelling, or asked for comments. That is surface level and useless. Name the actual mechanism, for example: curiosity gap, open loop the viewer finishes in their own head, pattern interrupt, identity threat or self-sorting ("this is about someone like me"), status or permission, cognitive dissonance, contrast and reversal, specificity that makes it feel true, tension and release, social proof, a belief the viewer wants to defend or correct, a rewatch or send-to-a-friend pull. Tie every point to the exact words or moment in the transcript, and explain why it works on the viewer's brain.\n\nBe honest about the limits: you only have the transcript and the numbers, not the visuals or the audio. If something is an inference, say so in the sentence.\n\n${input.goal === "comments" ? "THE GOAL IS COMMENTS. Explain why people felt they HAD to comment beyond the call to action: an unfinished argument, a side to take, something to correct, their own story to tell, a belief to defend, something safe or risky to admit. The ask is the least interesting part." : "THE GOAL IS VIEWS. Explain why people stayed, rewatched and sent it: the first-three-seconds promise, where attention could have dropped and what held it, the payoff gap, and the identity reason someone would forward it."}\n\nQUALITY OVER QUANTITY. Give only the few points that would make a creator say "wow, I never saw that". No padding, no repeating the same idea in different words, nothing included just to make the answer longer. This is a QUICK analysis: the skeleton is the star, the explanation is a few sharp lines. Every point under 25 words, every beat job under 12 words.\n\nThen turn it into reusable templates for the hook and for the body, and ask a few questions that pull the creator's own real story and details to fill them. Plain words.`;
    const content = `ABOUT ME:\n${ctx.me}\n\nTHE REEL TO STUDY:\n${ctx.ref}\n\n${input.idea.trim() ? `MY IDEA:\n${input.idea.trim()}\n\n` : ""}Study this reel as a viral creator would.`;
    const res = await getAnthropicClient().messages.parse({
      model: input.model,
      max_tokens: 5000,
      system,
      output_config: { format: zodOutputFormat(StudySchema) },
      messages: [{ role: "user", content }],
    });
    await logUsage("lab-study", res.usage as Usage);
    if (!res.parsed_output) return { error: "The AI didn't return a usable answer. Try again." };
    return { study: res.parsed_output, usage: costOf(input.model, res.usage as Usage) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
