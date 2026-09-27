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
}

export async function createManualScript(ideaId: string, content: string) {
  const trimmed = content.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_scripts")
    .insert({ idea_id: ideaId, content: trimmed });

  if (error) throw new Error(error.message);
  revalidatePath("/plan");
}
