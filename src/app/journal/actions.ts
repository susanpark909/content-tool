"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type JournalAttachmentInput = {
  url: string;
  type: string;
  name: string;
};

export async function createJournalEntry(
  content: string,
  attachments: JournalAttachmentInput[] = [],
  sourceReelId: string | null = null,
) {
  const trimmed = content.trim();
  if (!trimmed && attachments.length === 0) return;

  const supabase = await createClient();
  const { data: entry, error } = await supabase
    .from("ct_journal_entries")
    .insert({ content: trimmed, source_reel_id: sourceReelId })
    .select("id, created_at")
    .single();

  if (error) throw new Error(error.message);

  if (attachments.length > 0) {
    const { error: attachError } = await supabase.from("ct_journal_attachments").insert(
      attachments.map((a) => ({
        entry_id: entry.id,
        file_url: a.url,
        file_type: a.type,
        file_name: a.name,
      })),
    );
    if (attachError) throw new Error(attachError.message);
  }

  revalidatePath("/journal");
  if (sourceReelId) revalidatePath(`/research/reel/${sourceReelId}`);
}

export async function scheduleIdea(entryId: string, date: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ scheduled_date: date })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
  revalidatePath("/plan");
}

export async function setIdeaPosted(entryId: string, posted: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ posted, posted_at: posted ? new Date().toISOString() : null })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
  revalidatePath("/plan");
}

export async function setReadyToRecord(entryId: string, readyToRecord: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({
      ready_to_record: readyToRecord,
      ready_to_record_at: readyToRecord ? new Date().toISOString() : null,
    })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
  revalidatePath("/plan");
}

export async function setRecorded(entryId: string, recorded: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({
      recorded,
      recorded_at: recorded ? new Date().toISOString() : null,
    })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
  revalidatePath("/plan");
}

export async function setIdeaScripted(entryId: string, scripted: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ fleshed_out: scripted })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
  revalidatePath("/plan");
}

export async function updateJournalContent(entryId: string, content: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ content: content.trim() })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
}
