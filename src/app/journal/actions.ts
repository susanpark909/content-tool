"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createJournalEntry(formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .insert({ content });

  if (error) throw new Error(error.message);

  revalidatePath("/journal");
}
