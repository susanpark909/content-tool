"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type InstructionInput = {
  id: string | null;
  title: string;
  usedFor: string;
  body: string;
};

// Saves one instruction (creates it when there's no id). These are the
// instructions the AI inside the tool will read later.
export async function saveInstruction(input: InstructionInput): Promise<string> {
  const supabase = await createClient();
  const fields = {
    title: input.title.trim(),
    used_for: input.usedFor || "other",
    body: input.body,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase.from("ct_instructions").update(fields).eq("id", input.id);
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    return input.id;
  }

  const { data, error } = await supabase.from("ct_instructions").insert(fields).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  return data.id as string;
}

export async function deleteInstruction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_instructions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
