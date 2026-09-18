"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeReelAnalysis, type ReelAnalysis } from "@/lib/reel-analysis";

export type { ReelAnalysis };

export async function analyzeReel(reelId: string): Promise<ReelAnalysis> {
  return computeReelAnalysis(reelId);
}

export async function addHookPattern(name: string): Promise<{ id: string; name: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ct_hook_patterns")
    .insert({ name })
    .select("id, name")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function addFramework(
  name: string,
): Promise<{ id: string; name: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ct_frameworks")
    .insert({ name })
    .select("id, name")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function saveHook(
  reelId: string,
  hook: {
    hookText: string;
    patternId: string | null;
    emotionalMechanism: string;
    ctaUsed: string | null;
    whyItWorked: string;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_hooks").upsert(
    {
      reel_id: reelId,
      pattern_id: hook.patternId,
      hook_text: hook.hookText,
      emotional_mechanism: hook.emotionalMechanism,
      cta_used: hook.ctaUsed,
      why_it_worked: hook.whyItWorked,
    },
    { onConflict: "reel_id" },
  );

  if (error) throw new Error(error.message);

  revalidatePath(`/research/reel/${reelId}`);
  revalidatePath("/hooks");
}

export async function saveFrameworkExample(
  reelId: string,
  frameworkId: string,
  note: string | null,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_framework_examples").upsert(
    {
      reel_id: reelId,
      framework_id: frameworkId,
      note,
    },
    { onConflict: "reel_id" },
  );

  if (error) throw new Error(error.message);

  revalidatePath(`/research/reel/${reelId}`);
  revalidatePath("/frameworks");
}
