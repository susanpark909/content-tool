"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  revalidatePath("/brand");
}
