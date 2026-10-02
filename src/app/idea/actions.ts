"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Idea } from "./idea-table";

// Shared by the Idea list (/journal) and the Calendar (/plan) - every idea,
// with its latest script and its Saved Posts inspiration joined in.
export async function getAllIdeas(): Promise<Idea[]> {
  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("ct_journal_entries")
    .select(
      "id, content, created_at, fleshed_out, source_reel_id, scheduled_date, scheduled_time_minutes, posted, posted_at, format, goal, inspiration_reel_id, ct_journal_attachments(id, file_url, file_type, file_name)",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  type ScriptRow = {
    id: string;
    idea_id: string;
    content: string;
    hook: string | null;
    body: string | null;
    cta: string | null;
    created_at: string;
    updated_at: string;
  };

  const entryIds = (entries ?? []).map((e) => e.id);
  const { data: scripts } =
    entryIds.length > 0
      ? await supabase
          .from("ct_scripts")
          .select("id, idea_id, content, hook, body, cta, created_at, updated_at")
          .in("idea_id", entryIds)
          .order("created_at", { ascending: false })
      : { data: [] as ScriptRow[] };

  const scriptByIdea = new Map<string, ScriptRow>();
  for (const s of (scripts ?? []) as ScriptRow[]) {
    if (!scriptByIdea.has(s.idea_id)) {
      scriptByIdea.set(s.idea_id, s);
    }
  }

  const inspirationIds = Array.from(
    new Set((entries ?? []).map((e) => e.inspiration_reel_id).filter((id): id is string => Boolean(id))),
  );
  type InspirationReel = {
    id: string;
    hook_text: string | null;
    body_text: string | null;
    cta_text: string | null;
    owner_username: string | null;
    views: number | null;
    likes: number | null;
    comments_count: number | null;
    shares_count: number | null;
    duration_seconds: number | null;
  };
  const { data: inspirationReels } =
    inspirationIds.length > 0
      ? await supabase
          .from("ct_reels")
          .select(
            "id, hook_text, body_text, cta_text, owner_username, views, likes, comments_count, shares_count, duration_seconds",
          )
          .in("id", inspirationIds)
      : { data: [] as InspirationReel[] };
  const inspirationById = new Map((inspirationReels ?? []).map((r) => [r.id, r]));

  return (entries ?? []).map((entry) => {
    const script = scriptByIdea.get(entry.id);
    const inspiration = entry.inspiration_reel_id
      ? inspirationById.get(entry.inspiration_reel_id)
      : null;
    return {
      id: entry.id,
      text: entry.content ?? "",
      createdAt: entry.created_at,
      sourceReelId: entry.source_reel_id,
      attachments: (entry.ct_journal_attachments ?? []).map((att) => ({
        id: att.id,
        fileUrl: att.file_url,
        fileType: att.file_type,
        fileName: att.file_name,
      })),
      scheduledDate: entry.scheduled_date,
      scheduledTimeMinutes: entry.scheduled_time_minutes,
      posted: entry.posted,
      postedAt: entry.posted_at,
      scripted: entry.fleshed_out,
      scriptId: script?.id ?? null,
      hook: script?.hook ?? "",
      body: script?.body ?? script?.content ?? "",
      cta: script?.cta ?? "",
      scriptUpdatedAt: script?.updated_at ?? null,
      format: (entry.format as "reel" | "carousel") ?? "reel",
      goal: entry.goal as "views" | "comments" | "shares" | null,
      inspirationReelId: entry.inspiration_reel_id,
      inspiration: inspiration
        ? {
            id: inspiration.id,
            hookText: inspiration.hook_text ?? "",
            bodyText: inspiration.body_text,
            ctaText: inspiration.cta_text,
            ownerUsername: inspiration.owner_username,
            views: inspiration.views,
            likes: inspiration.likes,
            commentsCount: inspiration.comments_count,
            sharesCount: inspiration.shares_count,
            durationSeconds: inspiration.duration_seconds,
          }
        : null,
    };
  });
}

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

  revalidatePath("/idea");
  if (sourceReelId) revalidatePath(`/analyze-reel/reel/${sourceReelId}`);
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
  revalidatePath("/idea");
  return data;
}

export async function removeAttachment(attachmentId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) throw new Error(error.message);
  revalidatePath("/idea");
}

// Four fixed daily posting slots (9am/1pm/4pm/7pm), matching the design's
// calendar mock - posting time isn't manually editable, it's assigned in
// order as posts land on a day. Falls back to 8pm once all four are taken.
const DAY_SLOTS = [9 * 60, 13 * 60, 16 * 60, 19 * 60];
const OVERFLOW_SLOT = 20 * 60;

async function nextSlotMinutes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  date: string,
  excludeEntryId: string,
) {
  const { data } = await supabase
    .from("ct_journal_entries")
    .select("scheduled_time_minutes")
    .eq("scheduled_date", date)
    .neq("id", excludeEntryId);

  const used = new Set((data ?? []).map((r) => r.scheduled_time_minutes).filter((v) => v != null));
  return DAY_SLOTS.find((slot) => !used.has(slot)) ?? OVERFLOW_SLOT;
}

export async function scheduleIdea(entryId: string, date: string | null) {
  const supabase = await createClient();
  const scheduledTimeMinutes = date ? await nextSlotMinutes(supabase, date, entryId) : null;
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ scheduled_date: date, scheduled_time_minutes: scheduledTimeMinutes })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/idea");
  revalidatePath("/calendar");
  return scheduledTimeMinutes;
}

export async function setIdeaPosted(entryId: string, posted: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ posted, posted_at: posted ? new Date().toISOString() : null })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/idea");
  revalidatePath("/calendar");
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
  revalidatePath("/idea");
  revalidatePath("/calendar");
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
  revalidatePath("/idea");
  revalidatePath("/calendar");
}

export async function setIdeaScripted(entryId: string, scripted: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ fleshed_out: scripted })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/idea");
  revalidatePath("/calendar");
}

export async function setIdeaFormat(entryId: string, format: "reel" | "carousel") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ format })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/idea");
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
  revalidatePath("/idea");
}

export async function setIdeaInspiration(entryId: string, reelId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ inspiration_reel_id: reelId })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/idea");
}

export async function deleteIdea(entryId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_journal_entries").delete().eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/idea");
  revalidatePath("/calendar");
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
    revalidatePath("/idea");
    revalidatePath("/calendar");
    return scriptId;
  }

  if (!content) return null;

  const { data, error } = await supabase
    .from("ct_scripts")
    .insert({ idea_id: entryId, hook: fields.hook, body: fields.body, cta: fields.cta, content })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/idea");
  revalidatePath("/calendar");
  return data.id as string;
}

export async function updateJournalContent(entryId: string, content: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ content: content.trim() })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/idea");
}
