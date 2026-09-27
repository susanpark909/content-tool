"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateScriptContent(scriptId: string, content: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_scripts")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", scriptId);

  if (error) throw new Error(error.message);
  revalidatePath("/plan");
  revalidatePath("/journal");
}

export async function createManualScript(ideaId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ct_scripts")
    .insert({ idea_id: ideaId, content: trimmed })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/plan");
  revalidatePath("/journal");
  return data.id as string;
}
