import { createClient } from "@/lib/supabase/server";
import { IdeaTable, type Idea } from "./idea-table";

export const dynamic = "force-dynamic";

function frameworkName(
  framework: { name: string } | { name: string }[] | null,
): string | null {
  if (!framework) return null;
  return Array.isArray(framework) ? (framework[0]?.name ?? null) : framework.name;
}

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("ct_journal_entries")
    .select(
      "id, content, created_at, fleshed_out, flesh_out_answers, framework:ct_frameworks(name), source_reel_id, scheduled_date, posted, posted_at, ct_journal_attachments(id, file_url, file_type, file_name)",
    )
    .order("created_at", { ascending: false });

  const entryIds = (entries ?? []).map((e) => e.id);
  const { data: scripts } =
    entryIds.length > 0
      ? await supabase
          .from("ct_scripts")
          .select("id, idea_id, content")
          .in("idea_id", entryIds)
          .order("created_at", { ascending: false })
      : { data: [] as { id: string; idea_id: string; content: string }[] };

  const scriptByIdea = new Map<string, { id: string; content: string }>();
  for (const s of scripts ?? []) {
    if (!scriptByIdea.has(s.idea_id)) {
      scriptByIdea.set(s.idea_id, { id: s.id, content: s.content });
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-sm text-destructive">
          Couldn&apos;t load entries: {error.message}
        </p>
      </div>
    );
  }

  const ideas: Idea[] = (entries ?? []).map((entry) => ({
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
    scriptId: scriptByIdea.get(entry.id)?.id ?? null,
    scriptContent: scriptByIdea.get(entry.id)?.content ?? "",
    frameworkName: frameworkName(entry.framework),
    fleshOutAnswers: entry.flesh_out_answers,
  }));

  return <IdeaTable initial={ideas} />;
}
