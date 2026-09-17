import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JournalForm } from "./journal-form";

export const dynamic = "force-dynamic";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function JournalPage() {
  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("ct_journal_entries")
    .select("id, content, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Idea Journal</h1>
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
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">
                    {formatTimestamp(entry.created_at)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {entry.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
