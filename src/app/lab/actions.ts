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
  return { me: me || "(nothing saved in Settings yet)", ref };
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
      input.framework?.trim() && `THE FRAMEWORK TO FOLLOW:\n${input.framework.trim()}`,
      input.idea.trim() && `MY IDEA / WHAT THIS REEL IS ABOUT:\n${input.idea.trim()}`,
      input.answers?.trim() && `MY OWN STORY AND DETAILS (use these, they are real):\n${input.answers.trim()}`,
      input.tweak ? `HERE IS THE DRAFT:\n${input.tweak.previous}\n\nCHANGE IT LIKE THIS: ${input.tweak.instruction}\nKeep everything else that works. Same format.` : "Write the script now.",
    ].filter(Boolean);
    const res = await getAnthropicClient().messages.create({ model: input.model, max_tokens: 1500, system, messages: [{ role: "user", content: parts.join("\n\n") }] });
    await logUsage("lab-script", res.usage as Usage);
    return { script: textOf(res as never), usage: costOf(input.model, res.usage as Usage) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

// ---------------------------------------------------------------- study a reel
const StudySchema = z.object({
  why: z.array(z.string()).describe("3 to 5 specific reasons this reel did well on the goal, each tied to something actually in the transcript or numbers."),
  skeleton: z
    .array(
      z.object({
        beat: z.string().describe("Short name of the beat, e.g. 'Hook: the claim'."),
        job: z.string().describe("What this beat does for the viewer, one sentence."),
        template: z.string().describe("A fill-in-the-blank line for this beat with [brackets] where the creator's own content goes."),
      }),
    )
    .describe("The reel's structure as 4 to 7 ordered beats."),
  questions: z.array(z.string()).describe("5 to 7 short questions that pull out the creator's own real story, numbers and details to fill the skeleton, one per beat where possible."),
});
export type Study = z.infer<typeof StudySchema>;

export async function studyReel(input: { reelId: string; goal: LabGoal; model: LabModel; idea: string }): Promise<(LabRun & { study: Study }) | { error: string }> {
  try {
    const ctx = await loadContext(input.reelId);
    const system = `You are a sharp short-form content strategist. You study one reel and explain, concretely, why it worked, then turn it into a reusable skeleton. No generic advice: every reason must point at something in the transcript or the numbers. Plain words.\n\n${GOAL_GUIDE[input.goal]}`;
    const content = `ABOUT ME:\n${ctx.me}\n\nTHE REEL TO STUDY:\n${ctx.ref}\n\n${input.idea.trim() ? `MY IDEA:\n${input.idea.trim()}\n\n` : ""}Explain why this reel did well for the goal, give me its skeleton with fill-in templates, and ask me the questions that will help me fill it with my own real story.`;
    const res = await getAnthropicClient().messages.parse({
      model: input.model,
      max_tokens: 3000,
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
