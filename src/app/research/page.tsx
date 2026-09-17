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
      "id, kind, input_value, creator_username, created_at, reels:ct_reels(thumbnail_url, posted_at)",
    )
    .order("created_at", { ascending: false })
    .limit(20);

  function latestThumbnail(
    reels: { thumbnail_url: string | null; posted_at: string | null }[] | null,
  ) {
    if (!reels || reels.length === 0) return null;
    const sorted = [...reels].sort((a, b) =>
      (b.posted_at ?? "").localeCompare(a.posted_at ?? ""),
    );
    return sorted[0]?.thumbnail_url ?? null;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Research</h1>
        <p className="text-sm text-muted-foreground">
          Pull a creator&apos;s reels for inspiration, or analyze one reel
          directly.
        </p>
      </div>

      <ProfileResearchForm />
      <SingleReelForm />

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Past research
        </h2>
        {error && (
          <p className="text-sm text-destructive">
            Couldn&apos;t load past research: {error.message}
          </p>
        )}
        {!error && batches?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No research yet — run one above.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {batches?.map((batch) => {
            const thumb = latestThumbnail(batch.reels);
            return (
              <Link key={batch.id} href={`/research/${batch.id}`}>
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="flex items-center gap-3 p-3">
                    {thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded object-cover"
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {batch.creator_username
                          ? `@${batch.creator_username}`
                          : batch.input_value}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {batch.kind === "single_reel"
                          ? "Single reel"
                          : "Profile research"}{" "}
                        · {formatTimestamp(batch.created_at)}
                      </p>
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
