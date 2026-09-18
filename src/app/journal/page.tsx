import Link from "next/link";
import { PaperclipIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { JournalForm } from "./journal-form";
import { FleshOutDialog } from "./flesh-out-dialog";
import { FleshOutView } from "./flesh-out-view";
import { IdeaStatus } from "./idea-status";
import { AddToBrand } from "./add-to-brand";
import { IdeaContent } from "./idea-content";

function isImageType(type: string | null) {
  return Boolean(type?.startsWith("image/"));
}

export const dynamic = "force-dynamic";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function frameworkName(
  framework: { name: string } | { name: string }[] | null,
): string | null {
  if (!framework) return null;
  return Array.isArray(framework) ? (framework[0]?.name ?? null) : framework.name;
}

type FleshOutAnswer = { question: string; answer: string };

function ideaFullText(
  content: string | null,
  framework: string | null,
  answers: FleshOutAnswer[] | null,
) {
  const parts: string[] = [];
  if (content) parts.push(content);
  if (answers && answers.length > 0) {
    if (framework) parts.push(`Framework used: ${framework}`);
    for (const a of answers) {
      parts.push(`${a.question}\n${a.answer}`);
    }
  }
  return parts.join("\n\n");
}

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("ct_journal_entries")
    .select(
      "id, content, created_at, fleshed_out, flesh_out_answers, framework:ct_frameworks(name), source_reel_id, scheduled_date, posted, ct_journal_attachments(id, file_url, file_type, file_name)",
    )
    .order("created_at", { ascending: false });

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
        <div className="flex flex-col gap-3">
          {entries?.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {formatTimestamp(entry.created_at)}
                    </p>
                    {entry.source_reel_id && (
                      <Link href={`/research/reel/${entry.source_reel_id}`}>
                        <Badge variant="outline" className="text-[10px]">
                          From a reel
                        </Badge>
                      </Link>
                    )}
                  </div>
                  <IdeaContent entryId={entry.id} content={entry.content ?? ""} />
                  {entry.ct_journal_attachments &&
                    entry.ct_journal_attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {entry.ct_journal_attachments.map((att) => (
                          <a
                            key={att.id}
                            href={att.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block"
                          >
                            {isImageType(att.file_type) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={att.file_url}
                                alt=""
                                className="h-16 w-16 rounded object-cover"
                              />
                            ) : (
                              <span className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded border text-center text-[10px] text-muted-foreground">
                                <PaperclipIcon className="size-4" />
                                <span className="line-clamp-2 px-1">
                                  {att.file_name}
                                </span>
                              </span>
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                  <IdeaStatus
                    entryId={entry.id}
                    scheduledDate={entry.scheduled_date}
                    posted={entry.posted}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {entry.fleshed_out ? (
                      <FleshOutView
                        entryId={entry.id}
                        frameworkName={frameworkName(entry.framework)}
                        answers={entry.flesh_out_answers}
                      />
                    ) : (
                      <FleshOutDialog ideaId={entry.id} />
                    )}
                    <AddToBrand
                      entryId={entry.id}
                      content={ideaFullText(
                        entry.content,
                        frameworkName(entry.framework),
                        entry.flesh_out_answers,
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
