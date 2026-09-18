"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type HookFields = {
  hookText: string;
  patternId: string | null;
  emotionalMechanism: string;
  ctaUsed: string | null;
  whyItWorked: string;
};

export async function createHook(fields: HookFields) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_hooks").insert({
    hook_text: fields.hookText,
    pattern_id: fields.patternId,
    emotional_mechanism: fields.emotionalMechanism || null,
    cta_used: fields.ctaUsed,
    why_it_worked: fields.whyItWorked || null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/hooks");
}

export async function updateHook(hookId: string, fields: HookFields) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_hooks")
    .update({
      hook_text: fields.hookText,
      pattern_id: fields.patternId,
      emotional_mechanism: fields.emotionalMechanism || null,
      cta_used: fields.ctaUsed,
      why_it_worked: fields.whyItWorked || null,
    })
    .eq("id", hookId);

  if (error) throw new Error(error.message);
  revalidatePath("/hooks");
}

export async function deleteHook(hookId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_hooks").delete().eq("id", hookId);

  if (error) throw new Error(error.message);
  revalidatePath("/hooks");
}
