import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";

const AnalysisSchema = z.object({
  hookText: z
    .string()
    .describe("The exact opening hook line(s) from the transcript, verbatim"),
  hookPatternIndex: z
    .number()
    .int()
    .nullable()
    .describe(
      "0-based index into the provided hook pattern list that best matches this hook's structure, or null if none fit well",
    ),
  suggestedNewHookPattern: z
    .string()
    .nullable()
    .describe(
      "Only set if hookPatternIndex is null: a short name for a new hook pattern this hook represents",
    ),
  emotionalMechanism: z
    .string()
    .describe(
      "The primary emotional driver behind the hook, e.g. curiosity, fear, validation, surprise, aspiration, outrage",
    ),
  ctaUsed: z
    .string()
    .nullable()
    .describe("The call-to-action used in the post, if any, otherwise null"),
  whyItWorked: z
    .string()
    .describe(
      "2-3 sentence breakdown of why this hook and post likely performed well",
    ),
  frameworkIndex: z
    .number()
    .int()
    .nullable()
    .describe(
      "0-based index into the provided framework list that best matches this post's overall structure, or null if none fit well",
    ),
  suggestedNewFramework: z
    .string()
    .nullable()
    .describe(
      "Only set if frameworkIndex is null: a short name for a new framework pattern this post represents",
    ),
  frameworkMatchNote: z
    .string()
    .nullable()
    .describe(
      "One-line reason the matched (or suggested) framework fits this specific post's structure",
    ),
});

export type ReelAnalysis = {
  hookText: string;
  hookPatternId: string | null;
  hookPatternName: string | null;
  suggestedNewHookPattern: string | null;
  emotionalMechanism: string;
  ctaUsed: string | null;
  whyItWorked: string;
  frameworkId: string | null;
  frameworkName: string | null;
  suggestedNewFramework: string | null;
  frameworkMatchNote: string | null;
};

export async function computeReelAnalysis(reelId: string): Promise<ReelAnalysis> {
  const supabase = await createClient();

  const [
    { data: reel, error: reelError },
    { data: patterns, error: patternsError },
    { data: frameworks, error: frameworksError },
  ] = await Promise.all([
    supabase
      .from("ct_reels")
      .select("id, caption, transcript, transcription_status")
      .eq("id", reelId)
      .single(),
    supabase.from("ct_hook_patterns").select("id, name").order("created_at"),
    supabase.from("ct_frameworks").select("id, name").order("created_at"),
  ]);

  if (reelError) throw new Error(reelError.message);
  if (patternsError) throw new Error(patternsError.message);
  if (frameworksError) throw new Error(frameworksError.message);
  if (!reel) throw new Error("Reel not found");
  if (reel.transcription_status !== "ready" || !reel.transcript) {
    throw new Error("Transcript isn't ready yet");
  }
  if (!patterns || patterns.length === 0) {
    throw new Error("No hook patterns in the library yet");
  }
  if (!frameworks || frameworks.length === 0) {
    throw new Error("No frameworks in the library yet");
  }

  const patternList = patterns.map((p, i) => `${i}: ${p.name}`).join("\n");
  const frameworkList = frameworks.map((f, i) => `${i}: ${f.name}`).join("\n");

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1536,
    output_config: {
      effort: "medium",
      format: zodOutputFormat(AnalysisSchema),
    },
    messages: [
      {
        role: "user",
        content: `You are analyzing a short-form Instagram Reel's script to extract its opening hook and overall structure for a content creator's swipe file.

Caption:
"""
${reel.caption ?? "(none)"}
"""

Transcript:
"""
${reel.transcript}
"""

Available hook patterns (match ONLY from this list if one genuinely fits; set hookPatternIndex to null and suggest a new short pattern name only if none of these fit):
${patternList}

Available content frameworks, i.e. the shape of the whole post (match ONLY from this list if one genuinely fits; set frameworkIndex to null and suggest a new short framework name only if none of these fit):
${frameworkList}

Extract the opening hook verbatim, classify it, identify the emotional mechanism driving it, extract any CTA, explain briefly why it worked, and identify which framework the whole post's structure follows.`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Could not parse reel analysis");
  }

  const out = response.parsed_output;
  const matchedPattern =
    out.hookPatternIndex != null ? patterns[out.hookPatternIndex] : undefined;
  const matchedFramework =
    out.frameworkIndex != null ? frameworks[out.frameworkIndex] : undefined;

  return {
    hookText: out.hookText,
    hookPatternId: matchedPattern?.id ?? null,
    hookPatternName: matchedPattern?.name ?? null,
    suggestedNewHookPattern: matchedPattern ? null : out.suggestedNewHookPattern,
    emotionalMechanism: out.emotionalMechanism,
    ctaUsed: out.ctaUsed,
    whyItWorked: out.whyItWorked,
    frameworkId: matchedFramework?.id ?? null,
    frameworkName: matchedFramework?.name ?? null,
    suggestedNewFramework: matchedFramework ? null : out.suggestedNewFramework,
    frameworkMatchNote: out.frameworkMatchNote,
  };
}
