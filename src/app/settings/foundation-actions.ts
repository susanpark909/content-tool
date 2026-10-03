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

const TopicsSchema = z.object({
  topics: z
    .array(
      z.object({
        topic: z.string().describe("A broad content topic, 2 to 5 words"),
        subtopics: z
          .array(z.string())
          .describe("EXACTLY 3 to 5 specific sub-topics under this broad topic. Never more than 5. Each under 10 words"),
      }),
    )
    .describe("EXACTLY 3 or 4 broad content topics. Never more than 4."),
});

export type ContentTopic = { topic: string; subtopics: string[] };

// Asks the AI for the person's content topics: where the four Ikigai boxes
// overlap, as 3-4 broad topics with 3-5 sub-topics each. Returns suggestions
// only; nothing is saved until the user keeps them and presses Save.
export async function findContentTopics(input: {
  goodAt: string;
  loveLearning: string;
  peopleNeed: string;
  peoplePay: string;
}): Promise<ContentTopic[]> {
  const filled = Object.values(input).filter((v) => v.trim()).length;
  if (filled < 2) throw new Error("Fill in at least two of the four boxes first.");

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1500,
    output_config: { effort: "medium", format: zodOutputFormat(TopicsSchema) },
    messages: [
      {
        role: "user",
        content: `A content creator is working out their content topics. Their Ikigai has four circles. The best content topics sit where these overlap: things they are good at, love learning, that people want or need, and that people actually pay for. If a list is empty, ignore it. Stay close to their own words; do not invent skills they didn't mention.

Give EXACTLY 3 or 4 BROAD topics (the big themes they can talk about) — never more than 4, even if you could think of more; merge related ideas into one broad topic instead. Under each broad topic give EXACTLY 3 to 5 more specific sub-topics — never more than 5. Keep it tight: pick only the strongest.

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

  // Enforce the shape in code too: at most 4 broad topics, at most 5 sub-topics each.
  return (response.parsed_output?.topics ?? [])
    .map((t) => ({ topic: t.topic.trim(), subtopics: t.subtopics.map((x) => x.trim()).filter(Boolean).slice(0, 5) }))
    .filter((t) => t.topic)
    .slice(0, 4);
}
