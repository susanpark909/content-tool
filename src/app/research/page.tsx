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
    .select("id, kind, input_value, creator_username, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

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
          {batches?.map((batch) => (
            <Link key={batch.id} href={`/research/${batch.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-center justify-between p-3">
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
          ))}
        </div>
      </div>
    </div>
  );
}
