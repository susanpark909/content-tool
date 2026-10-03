"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";

const FOUNDATION_ID = "00000000-0000-0000-0000-000000000001";

export type Foundation = {
  goodAt: string;
  loveLearning: string;
  peopleNeed: string;
  peoplePay: string;
  overlap: string;
  journey: string;
  forAgainst: string;
};

// Saves the "what I talk about" foundation. The AI in the tool will read this
// later to help come up with ideas.
export async function saveFoundation(f: Foundation) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_brand_foundation").upsert({
    id: FOUNDATION_ID,
    good_at: f.goodAt,
    love_learning: f.loveLearning,
    people_need: f.peopleNeed,
    people_pay: f.peoplePay,
    overlap: f.overlap,
    journey: f.journey,
    for_against: f.forAgainst,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

const OverlapSchema = z.object({
  topics: z
    .array(z.string())
    .describe(
      "6 to 10 topics this person could talk about, each one short (under 12 words), sitting in the overlap of all four lists",
    ),
});

// Asks the AI to find where the four lists overlap. Returns suggestions only;
// nothing is saved until the user keeps them and presses Save.
export async function findOverlap(input: {
  goodAt: string;
  loveLearning: string;
  peopleNeed: string;
  peoplePay: string;
}): Promise<string[]> {
  const filled = Object.values(input).filter((v) => v.trim()).length;
  if (filled < 2) throw new Error("Fill in at least two of the four boxes first.");

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: { effort: "medium", format: zodOutputFormat(OverlapSchema) },
    messages: [
      {
        role: "user",
        content: `A content creator is working out what they can talk about. The best topics sit in the overlap of four things. Find the topics that live where these lists overlap — things they are good at, love learning, that people want or need, and that people actually pay for. If a list is empty, ignore it. Stay close to their own words; do not invent skills they didn't mention.

What I'm good at:
${input.goodAt || "(empty)"}

What I love learning:
${input.loveLearning || "(empty)"}

What people want / need:
${input.peopleNeed || "(empty)"}

What people actually pay for:
${input.peoplePay || "(empty)"}`,
      },
    ],
  });

  return (response.parsed_output?.topics ?? []).map((t) => t.trim()).filter(Boolean);
}
