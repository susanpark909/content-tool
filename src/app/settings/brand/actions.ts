"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";

const PROFILE_ID = "00000000-0000-0000-0000-000000000001";

export type BrandProfileFields = {
  voiceTone: string;
  phrasesToUse: string;
  phrasesToAvoid: string;
  audience: string;
  contentPillars: string;
  personalStories: string;
  opinionsPovs: string;
  strongOpinionWedge: string;
  offersProducts: string;
  examplesLikeSusan: string;
  examplesHates: string;
};

const FIELD_META: { key: keyof BrandProfileFields; label: string; hint: string }[] = [
  { key: "voiceTone", label: "Voice / tone", hint: "How she sounds — casual, blunt, warm, dry, etc." },
  { key: "phrasesToUse", label: "Phrases to use", hint: "Words/phrases she naturally reaches for" },
  { key: "phrasesToAvoid", label: "Phrases to avoid", hint: "Words/phrases that don't sound like her" },
  { key: "audience", label: "Audience", hint: "Who she's actually talking to" },
  { key: "contentPillars", label: "Content pillars / topics", hint: "" },
  { key: "personalStories", label: "Personal stories / experiences", hint: "Real things that happened to her, worth referencing" },
  { key: "opinionsPovs", label: "Opinions / POVs", hint: "" },
  {
    key: "strongOpinionWedge",
    label: "Strong opinion / wedge",
    hint: "A specific contrarian belief she holds that most people in her space would push back on — the best source for polarizing, high-engagement hooks",
  },
  { key: "offersProducts", label: "Offers / products", hint: "When relevant to mention in content" },
  { key: "examplesLikeSusan", label: "Examples of content that feels most like her", hint: "" },
  { key: "examplesHates", label: "Examples of content/style she hates", hint: "" },
];

function fieldSchema(label: string) {
  return z
    .string()
    .describe(
      `The full, updated content for "${label}" after merging in anything new and relevant from the input. If the input has nothing relevant to this field, return the existing value unchanged verbatim (an empty string "" if it was already blank — never the literal placeholder text describing it as blank). Never fabricate content that wasn't in the existing value or the new input.`,
    );
}

const MergeSchema = z.object({
  voiceTone: fieldSchema("Voice / tone"),
  phrasesToUse: fieldSchema("Phrases to use"),
  phrasesToAvoid: fieldSchema("Phrases to avoid"),
  audience: fieldSchema("Audience"),
  contentPillars: fieldSchema("Content pillars / topics"),
  personalStories: fieldSchema("Personal stories / experiences"),
  opinionsPovs: fieldSchema("Opinions / POVs"),
  strongOpinionWedge: fieldSchema("Strong opinion / wedge"),
  offersProducts: fieldSchema("Offers / products"),
  examplesLikeSusan: fieldSchema("Examples of content that feels most like her"),
  examplesHates: fieldSchema("Examples of content/style she hates"),
});

export async function updateBrandProfileFromText(
  rawText: string,
): Promise<BrandProfileFields> {
  const supabase = await createClient();
  const { data: current, error: fetchError } = await supabase
    .from("ct_brand_profile")
    .select(
      "voice_tone, phrases_to_use, phrases_to_avoid, audience, content_pillars, personal_stories, opinions_povs, strong_opinion_wedge, offers_products, examples_like_susan, examples_hates",
    )
    .eq("id", PROFILE_ID)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const currentFields: BrandProfileFields = {
    voiceTone: current.voice_tone ?? "",
    phrasesToUse: current.phrases_to_use ?? "",
    phrasesToAvoid: current.phrases_to_avoid ?? "",
    audience: current.audience ?? "",
    contentPillars: current.content_pillars ?? "",
    personalStories: current.personal_stories ?? "",
    opinionsPovs: current.opinions_povs ?? "",
    strongOpinionWedge: current.strong_opinion_wedge ?? "",
    offersProducts: current.offers_products ?? "",
    examplesLikeSusan: current.examples_like_susan ?? "",
    examplesHates: current.examples_hates ?? "",
  };

  const currentBlock = FIELD_META.map(
    (f) => `${f.label}${f.hint ? ` (${f.hint})` : ""}:\n${currentFields[f.key] || "(currently blank — leave as an empty string unless the new notes add something)"}`,
  ).join("\n\n");

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 4096,
    output_config: {
      effort: "medium",
      format: zodOutputFormat(MergeSchema),
    },
    messages: [
      {
        role: "user",
        content: `You maintain a content creator's "Brand Profile" — structured notes used as context so AI-generated scripts sound like her, not generic AI. She just gave you new raw notes (typed, spoken, or pasted from something she had) to fold into the profile.

Current profile:
"""
${currentBlock}
"""

New notes to incorporate:
"""
${rawText}
"""

For each field, return its full updated content: merge in anything from the new notes that's relevant to that field (append/integrate naturally, don't just tack text on), while preserving existing good content. If the new notes don't add anything relevant to a field, return that field's existing content unchanged, verbatim — an empty string "" if it was already blank, never a phrase describing it as blank or empty. Don't invent details that aren't in the current profile or the new notes. Keep her actual wording/phrasing from the notes where possible rather than paraphrasing into generic language.`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Could not parse brand profile update");
  }

  const updated = response.parsed_output;

  const { error: updateError } = await supabase
    .from("ct_brand_profile")
    .update({
      voice_tone: updated.voiceTone || null,
      phrases_to_use: updated.phrasesToUse || null,
      phrases_to_avoid: updated.phrasesToAvoid || null,
      audience: updated.audience || null,
      content_pillars: updated.contentPillars || null,
      personal_stories: updated.personalStories || null,
      opinions_povs: updated.opinionsPovs || null,
      strong_opinion_wedge: updated.strongOpinionWedge || null,
      offers_products: updated.offersProducts || null,
      examples_like_susan: updated.examplesLikeSusan || null,
      examples_hates: updated.examplesHates || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", PROFILE_ID);

  if (updateError) throw new Error(updateError.message);

  revalidatePath("/settings/brand");
  return updated;
}

export type PendingBrandNote = {
  id: string;
  content: string;
  sourceEntryId: string | null;
};

export async function queueBrandProfileNote(
  content: string,
  sourceEntryId: string | null = null,
) {
  const trimmed = content.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_brand_profile_pending")
    .insert({ content: trimmed, source_entry_id: sourceEntryId });

  if (error) throw new Error(error.message);
  revalidatePath("/settings/brand");
}

export async function dismissBrandProfileNote(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_brand_profile_pending")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/brand");
}

export async function applyBrandProfileNote(
  id: string,
  editedContent: string,
): Promise<BrandProfileFields> {
  const updated = await updateBrandProfileFromText(editedContent);
  await dismissBrandProfileNote(id);
  return updated;
}

export async function saveBrandProfile(fields: BrandProfileFields) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_brand_profile")
    .update({
      voice_tone: fields.voiceTone || null,
      phrases_to_use: fields.phrasesToUse || null,
      phrases_to_avoid: fields.phrasesToAvoid || null,
      audience: fields.audience || null,
      content_pillars: fields.contentPillars || null,
      personal_stories: fields.personalStories || null,
      opinions_povs: fields.opinionsPovs || null,
      strong_opinion_wedge: fields.strongOpinionWedge || null,
      offers_products: fields.offersProducts || null,
      examples_like_susan: fields.examplesLikeSusan || null,
      examples_hates: fields.examplesHates || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", PROFILE_ID);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/brand");
}
