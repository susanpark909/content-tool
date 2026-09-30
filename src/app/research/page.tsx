import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/page-shell";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { AnalyzeForm, SingleReelForm } from "./research-forms";
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
    <PageShell>
      <div>
        <h1 className="text-[64px] leading-[0.95] font-black tracking-[-0.04em]">
          Analyze Reel
          <span className="ml-1 inline-block size-3 rounded-full bg-[#C6FF3D] align-baseline" />
        </h1>
        <p className="mt-2 text-[15px] font-medium text-[#4a4a48]">
          Pull the numbers on a creator, or on one reel.
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
          <AnalyzeForm />
          <SingleReelForm />

          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-black tracking-[-0.02em]">Past analyses</h2>
            {error && (
              <p className="text-sm text-[#D10A6E]">
                Couldn&apos;t load past analyses: {error.message}
              </p>
            )}
            {!error && batches?.length === 0 && (
              <p className="text-sm font-medium text-[#4a4a48]">
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
                <div className="rounded-lg border border-[#F0F0F1] bg-white p-3.5 shadow-[0_4px_16px_rgba(13,13,13,0.09)] transition-colors hover:bg-[#FBFBFA]">
                  <p className="text-sm font-bold">
                    {batch.creator_username
                      ? `@${batch.creator_username}`
                      : batch.input_value}
                  </p>
                  <p className="text-xs font-medium text-[#4a4a48]">
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
                    <p className="text-xs font-semibold text-[#D10A6E]">
                      Incomplete pull — Instagram may have blocked part of
                      this request. Results may not reflect the true top
                      reels.
                    </p>
                  )}
                </div>
              </Link>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="queue" className="flex flex-col gap-4">
          {queueError && (
            <p className="text-sm text-[#D10A6E]">
              Couldn&apos;t load the queue: {queueError.message}
            </p>
          )}
          {!queueError && queueRows.length === 0 ? (
            <p className="text-sm font-medium text-[#4a4a48]">
              Nothing queued yet — share a reel in from your phone and
              it&apos;ll show up here.
            </p>
          ) : (
            <QueueClient rows={queueRows} />
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
