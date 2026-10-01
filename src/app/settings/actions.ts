"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";

const PROFILE_ID = "00000000-0000-0000-0000-000000000001";
const GOALS_ID = "00000000-0000-0000-0000-000000000001";

export type BrandProfile = {
  rawText: string;
  headline: string;
  about: string;
  voice: string[];
  knownFor: string[];
  storyBeats: string[];
};

export type IdealClient = {
  rawText: string;
  name: string;
  about: string;
  tags: string[];
  painPoints: string[];
  desires: string[];
  topics: string[];
};

function arr(v: string[] | undefined, n: number) {
  return (v ?? []).map(String).filter(Boolean).slice(0, n);
}

export async function saveBrandText(rawText: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_brand_profile")
    .update({ raw_text: rawText })
    .eq("id", PROFILE_ID);
  if (error) throw new Error(error.message);
}

const BrandSchema = z.object({
  headline: z.string().describe("A short, vivid one-line brand headline in first person spirit, 3-7 words"),
  about: z.string().describe("A 1-2 sentence bio, max 220 characters"),
  voice: z.array(z.string()).describe("3-5 one or two word descriptors of how they sound"),
  known: z.array(z.string()).describe("Exactly 3 things they want to be known for, max 6 words each"),
  story: z.array(z.string()).describe("Exactly 3 key moments from their story worth telling in content, max 7 words each"),
});

export async function generateBrandProfile(rawText: string): Promise<BrandProfile> {
  const text = rawText.trim();
  if (!text) throw new Error("Add some notes first.");

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: { effort: "medium", format: zodOutputFormat(BrandSchema) },
    messages: [
      {
        role: "user",
        content: `You help a content creator define their personal brand. From their notes about themselves below, produce a headline, a short bio, voice descriptors, what they want to be known for, and key story beats. Use their own wording where possible.

Notes:
${text}`,
      },
    ],
  });

  if (!response.parsed_output) throw new Error("Couldn't generate that one. Try again, or add a bit more detail.");
  const j = response.parsed_output;

  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_brand_profile")
    .update({
      raw_text: text,
      headline: j.headline,
      about: j.about,
      voice: arr(j.voice, 5),
      known_for: arr(j.known, 3),
      story_beats: arr(j.story, 3),
      updated_at: new Date().toISOString(),
    })
    .eq("id", PROFILE_ID);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  return {
    rawText: text,
    headline: j.headline,
    about: j.about,
    voice: arr(j.voice, 5),
    knownFor: arr(j.known, 3),
    storyBeats: arr(j.story, 3),
  };
}

const IdealClientSchema = z.object({
  name: z.string().describe('A short, vivid persona name for the ideal client, 3-5 words, e.g. "The quietly brilliant founder"'),
  about: z.string().describe("1-2 sentences describing the ideal client, max 220 characters"),
  tags: z.array(z.string()).describe("4-6 very short descriptors, 1-3 words each"),
  painPoints: z.array(z.string()).describe("Exactly 3 of the ideal client's pain points, max 6 words each"),
  desires: z.array(z.string()).describe("Exactly 3 of the ideal client's goals and desires, max 6 words each"),
  topics: z.array(z.string()).describe("Exactly 3 content topics the creator should post about for this client, 1-4 words each"),
});

export async function saveIdealClientText(rawText: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_goals")
    .update({ ideal_client_notes: rawText })
    .eq("id", GOALS_ID);
  if (error) throw new Error(error.message);
}

export async function generateIdealClient(rawText: string): Promise<IdealClient> {
  const text = rawText.trim();
  if (!text) throw new Error("Add some notes first.");

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: { effort: "medium", format: zodOutputFormat(IdealClientSchema) },
    messages: [
      {
        role: "user",
        content: `You help a content creator define their ideal client avatar (ICA). From the creator's notes below, produce a persona name, a short description, tags, pain points, desires, and content topics. If the notes name specific topics, use them.

Notes:
${text}`,
      },
    ],
  });

  if (!response.parsed_output) throw new Error("Couldn't generate that one. Try again, or add a bit more detail.");
  const j = response.parsed_output;

  const tags = arr(j.tags, 6);
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_goals")
    .update({
      ideal_client_notes: text,
      ideal_client_name: j.name,
      ideal_client: j.about,
      ideal_client_tags: tags.join(", "),
      ideal_client_pain_points: arr(j.painPoints, 3),
      ideal_client_desires: arr(j.desires, 3),
      ideal_client_topics: arr(j.topics, 3),
      updated_at: new Date().toISOString(),
    })
    .eq("id", GOALS_ID);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath("/");
  return {
    rawText: text,
    name: j.name,
    about: j.about,
    tags,
    painPoints: arr(j.painPoints, 3),
    desires: arr(j.desires, 3),
    topics: arr(j.topics, 3),
  };
}

export type PendingBrandNote = {
  id: string;
  content: string;
  sourceEntryId: string | null;
};

export async function queueBrandProfileNote(content: string, sourceEntryId: string | null = null) {
  const trimmed = content.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_brand_profile_pending")
    .insert({ content: trimmed, source_entry_id: sourceEntryId });

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function dismissBrandProfileNote(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_brand_profile_pending").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function applyBrandProfileNote(id: string, editedContent: string, currentRawText: string): Promise<BrandProfile> {
  const combined = [currentRawText.trim(), editedContent.trim()].filter(Boolean).join("\n\n");
  const updated = await generateBrandProfile(combined);
  await dismissBrandProfileNote(id);
  return updated;
}
