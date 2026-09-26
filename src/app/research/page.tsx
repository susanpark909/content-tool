import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileResearchForm, SingleReelForm } from "./research-forms";

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
    </div>
  );
}
