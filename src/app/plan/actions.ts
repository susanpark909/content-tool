"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createIdeaOnDate(content: string, scheduledDate: string) {
  const trimmed = content.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .insert({ content: trimmed, scheduled_date: scheduledDate });

  if (error) throw new Error(error.message);
  revalidatePath("/plan");
  revalidatePath("/journal");
}

export async function moveIdeaToDate(entryId: string, scheduledDate: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ scheduled_date: scheduledDate })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/plan");
  revalidatePath("/journal");
}
