"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { scheduleIdea } from "@/app/idea/actions";

export { scheduleIdea };

// Quick-add from the Calendar's day panel - a bare idea, scheduled straight
// onto that day (time auto-assigned the same way dragging one there does).
export async function createIdeaOnDate(content: string, scheduledDate: string) {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ct_journal_entries")
    .insert({ content: trimmed })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const scheduledTimeMinutes = await scheduleIdea(data.id, scheduledDate);
  revalidatePath("/calendar");
  revalidatePath("/idea");
  return { id: data.id as string, scheduledTimeMinutes };
}
