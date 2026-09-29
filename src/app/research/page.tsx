import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ProfileResearchForm, SingleReelForm } from "./research-forms";
import { QueueClient, type QueueRow } from "./queue-client";

export const dynamic = "force-dynamic";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function ResearchPage() {
  const supabase = await createClient();
  const { data: batches, error } = await supabase
    .from("ct_research_batches")
    .select(
      "id, kind, input_value, creator_username, creator_avatar_url, created_at, date_from, date_to, results_limit, dismissed_incomplete_warning, reels:ct_reels(id)",
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: queueItems, error: queueError } = await supabase
    .from("ct_reel_queue")
    .select(
      "id, url, status, caption, owner_username, posted_at, views, likes, comments_count, shares_count, duration_seconds, error_message, created_at",
    )
    .order("created_at", { ascending: false });

  const queueRows: QueueRow[] = (queueItems ?? []).map((r) => ({
    id: r.id,
    url: r.url,
    status: r.status as QueueRow["status"],
    caption: r.caption,
    ownerUsername: r.owner_username,
    postedAt: r.posted_at,
    views: r.views,
    likes: r.likes,
    commentsCount: r.comments_count,
    sharesCount: r.shares_count,
    durationSeconds: r.duration_seconds,
    errorMessage: r.error_message,
    createdAt: r.created_at,
  }));

  function formatDateOnly(value: string | null) {
    if (!value) return null;
    return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Analyze</h1>
        <p className="text-sm text-muted-foreground">
          Pull a creator&apos;s reels for inspiration, or analyze one reel
          directly.
        </p>
      </div>

      <Tabs defaultValue="analyze">
        <TabsList>
          <TabsTrigger value="analyze">Analyze</TabsTrigger>
          <TabsTrigger value="queue">
            Queue{queueRows.length > 0 ? ` (${queueRows.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analyze" className="flex flex-col gap-6">
          <ProfileResearchForm />
          <SingleReelForm />

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Past analyses
            </h2>
            {error && (
              <p className="text-sm text-destructive">
                Couldn&apos;t load past analyses: {error.message}
              </p>
            )}
            {!error && batches?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No analyses yet — run one above.
              </p>
            )}
            <div className="flex flex-col gap-2">
              {batches?.map((batch) => {
            const pulledCount = batch.reels?.length ?? 0;
            const requested = batch.results_limit;
            const hasDateRange = Boolean(batch.date_from || batch.date_to);
            const incomplete =
              batch.kind === "profile" &&
              !hasDateRange &&
              requested != null &&
              pulledCount < requested &&
              !batch.dismissed_incomplete_warning;
            const dateFrom = formatDateOnly(batch.date_from);
            const dateTo = formatDateOnly(batch.date_to);
            return (
              <Link key={batch.id} href={`/research/${batch.id}`}>
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="flex items-center gap-3 p-3">
                    <div>
                      <p className="text-sm font-medium">
                        {batch.creator_username
                          ? `@${batch.creator_username}`
                          : batch.input_value}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {batch.kind === "single_reel"
                          ? "Single reel"
                          : "Profile analysis"}{" "}
                        · pulled {formatTimestamp(batch.created_at)}
                        {batch.kind === "profile" && (
                          <>
                            {" "}
                            · {pulledCount}
                            {requested != null ? ` of ${requested}` : ""}{" "}
                            reels
                            {(dateFrom || dateTo) && (
                              <> · {dateFrom ?? "any"} to {dateTo ?? "now"}</>
                            )}
                          </>
                        )}
                      </p>
                      {incomplete && (
                        <p className="text-xs text-destructive">
                          Incomplete pull — Instagram may have blocked part of
                          this request. Results may not reflect the true top
                          reels.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="queue" className="flex flex-col gap-4">
          {queueError && (
            <p className="text-sm text-destructive">
              Couldn&apos;t load the queue: {queueError.message}
            </p>
          )}
          {!queueError && queueRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing queued yet — share a reel in from your phone and
              it&apos;ll show up here.
            </p>
          ) : (
            <QueueClient rows={queueRows} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
