import { createClient } from "@/lib/supabase/server";
import { IdeaTable, type Idea } from "./idea-table";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("ct_journal_entries")
    .select(
      "id, content, created_at, fleshed_out, source_reel_id, scheduled_date, posted, posted_at, format, goal, inspiration_reel_id, ct_journal_attachments(id, file_url, file_type, file_name)",
    )
    .order("created_at", { ascending: false });

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

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-destructive">
          Couldn&apos;t load entries: {error.message}
        </p>
      </div>
    );
  }

  const ideas: Idea[] = (entries ?? []).map((entry) => {
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

  return <IdeaTable initial={ideas} />;
}
