import Link from "next/link";
import { PaperclipIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JournalForm } from "./journal-form";
import { FleshOutDialog } from "./flesh-out-dialog";
import { FleshOutView } from "./flesh-out-view";
import { IdeaStatus } from "./idea-status";
import { AddToBrand } from "./add-to-brand";

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

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("ct_journal_entries")
    .select(
      "id, content, created_at, fleshed_out, flesh_out_answers, framework:ct_frameworks(name), source_reel_id, scheduled_date, posted, ct_journal_attachments(id, file_url, file_type, file_name)",
    )
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-[1fr_320px]">
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

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Past entries
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
        <ScrollArea className="h-[70vh] pr-3">
          <div className="flex flex-col gap-2">
            {entries?.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="flex flex-col gap-2 p-3">
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
                  {entry.content && (
                    <p className="whitespace-pre-wrap text-sm">
                      {entry.content}
                    </p>
                  )}
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
                        frameworkName={frameworkName(entry.framework)}
                        answers={entry.flesh_out_answers}
                      />
                    ) : (
                      <FleshOutDialog ideaId={entry.id} />
                    )}
                    <AddToBrand content={entry.content ?? ""} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
