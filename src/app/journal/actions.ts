"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type JournalAttachmentInput = {
  url: string;
  type: string;
  name: string;
};

export type SavedScriptOption = {
  id: string;
  hookText: string;
  bodyText: string | null;
  ctaText: string | null;
  ownerUsername: string | null;
  views: number | null;
  likes: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  durationSeconds: number | null;
};

// Data for the Idea editor's "Saved Posts" inspiration picker - the same
// saved-script library shown on the Library page's Scripts tab.
export async function getSavedScriptsForInspiration(): Promise<SavedScriptOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ct_reels")
    .select(
      "id, hook_text, body_text, cta_text, owner_username, views, likes, comments_count, shares_count, duration_seconds",
    )
    .not("hook_text", "is", null)
    .order("views", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    hookText: r.hook_text ?? "",
    bodyText: r.body_text,
    ctaText: r.cta_text,
    ownerUsername: r.owner_username,
    views: r.views,
    likes: r.likes,
    commentsCount: r.comments_count,
    sharesCount: r.shares_count,
    durationSeconds: r.duration_seconds,
  }));
}

export async function createJournalEntry(
  content: string,
  attachments: JournalAttachmentInput[] = [],
  sourceReelId: string | null = null,
) {
  const trimmed = content.trim();
  if (!trimmed && attachments.length === 0) return null;

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
  return { id: entry.id as string, createdAt: entry.created_at as string };
}

export async function addAttachmentsToEntry(
  entryId: string,
  attachments: JournalAttachmentInput[],
) {
  if (attachments.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ct_journal_attachments")
    .insert(
      attachments.map((a) => ({
        entry_id: entryId,
        file_url: a.url,
        file_type: a.type,
        file_name: a.name,
      })),
    )
    .select("id, file_url, file_type, file_name");

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
  return data;
}

export async function removeAttachment(attachmentId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
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

export async function setIdeaFormat(entryId: string, format: "reel" | "carousel") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ format })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
}

export async function setIdeaGoal(
  entryId: string,
  goal: "views" | "comments" | "shares" | null,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ goal })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
}

export async function setIdeaInspiration(entryId: string, reelId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ inspiration_reel_id: reelId })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
}

export async function deleteIdea(entryId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_journal_entries").delete().eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
  revalidatePath("/plan");
}

// Saves the Hook/Body/CTA split for an idea's script. Also writes a joined
// "hook\n\nbody\n\ncta" into `content` so the Calendar page (which still just
// reads the one content blob) keeps working without changes.
export async function saveScriptSections(
  entryId: string,
  scriptId: string | null,
  fields: { hook: string; body: string; cta: string },
) {
  const supabase = await createClient();
  const content = [fields.hook, fields.body, fields.cta]
    .map((t) => t.trim())
    .filter(Boolean)
    .join("\n\n");

  if (scriptId) {
    const { error } = await supabase
      .from("ct_scripts")
      .update({
        hook: fields.hook,
        body: fields.body,
        cta: fields.cta,
        content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scriptId);
    if (error) throw new Error(error.message);
    revalidatePath("/journal");
    revalidatePath("/plan");
    return scriptId;
  }

  if (!content) return null;

  const { data, error } = await supabase
    .from("ct_scripts")
    .insert({ idea_id: entryId, hook: fields.hook, body: fields.body, cta: fields.cta, content })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/journal");
  revalidatePath("/plan");
  return data.id as string;
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
