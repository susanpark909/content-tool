import { createClient } from "@/lib/supabase/server";
import { JournalForm } from "./journal-form";
import { IdeaCard } from "./idea-card";

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
      "id, content, created_at, flesh_out_answers, framework:ct_frameworks(name), source_reel_id, scheduled_date, posted, ct_journal_attachments(id, file_url, file_type, file_name)",
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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Idea</h1>
          <p className="text-sm text-muted-foreground">
            Jot down ideas as they come. Every entry is timestamped and saved
            automatically.
          </p>
        </div>
        <JournalForm />
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Idea Collection
        </h2>
        {error && (
          <p className="text-sm text-destructive">
            Couldn&apos;t load entries: {error.message}
          </p>
        )}
        {!error && entries?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No entries yet — your first one will show up here.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {entries?.map((entry) => (
            <IdeaCard
              key={entry.id}
              entryId={entry.id}
              content={entry.content ?? ""}
              createdAt={entry.created_at}
              sourceReelId={entry.source_reel_id}
              attachments={(entry.ct_journal_attachments ?? []).map((att) => ({
                id: att.id,
                fileUrl: att.file_url,
                fileType: att.file_type,
                fileName: att.file_name,
              }))}
              scheduledDate={entry.scheduled_date}
              posted={entry.posted}
              frameworkName={frameworkName(entry.framework)}
              fleshOutAnswers={entry.flesh_out_answers}
              scriptId={scriptByIdea.get(entry.id)?.id ?? null}
              scriptContent={scriptByIdea.get(entry.id)?.content ?? ""}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
