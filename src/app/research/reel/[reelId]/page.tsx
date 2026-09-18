import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/back-link";
import { TranscribeButton, RefreshStatusButton } from "./reel-actions";
import { AnalysisPanel } from "./analysis-panel";
import type { ReelAnalysis } from "@/lib/reel-analysis";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function ReelDetailPage({
  params,
}: {
  params: Promise<{ reelId: string }>;
}) {
  const { reelId } = await params;
  const supabase = await createClient();

  const { data: reel } = await supabase
    .from("ct_reels")
    .select(
      "id, batch_id, url, caption, thumbnail_url, owner_username, posted_at, views, likes, comments_count, shares_count, transcript, transcription_status, transcription_error, analysis_status, analysis_result, analysis_error",
    )
    .eq("id", reelId)
    .single();

  if (!reel) notFound();

  const [
    { data: hookPatterns },
    { data: frameworks },
    { data: savedHookRow },
    { data: savedFrameworkExampleRow },
  ] = await Promise.all([
    supabase.from("ct_hook_patterns").select("id, name").order("created_at"),
    supabase.from("ct_frameworks").select("id, name").order("created_at"),
    supabase
      .from("ct_hooks")
      .select("hook_text, pattern_id, emotional_mechanism, cta_used, why_it_worked")
      .eq("reel_id", reelId)
      .maybeSingle(),
    supabase
      .from("ct_framework_examples")
      .select("framework_id, note")
      .eq("reel_id", reelId)
      .maybeSingle(),
  ]);

  const commentRate = reel.views > 0 ? reel.comments_count / reel.views : 0;
  const shareRate =
    reel.views > 0 && reel.shares_count != null
      ? reel.shares_count / reel.views
      : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
      <BackLink fallbackHref={`/research/${reel.batch_id}`} />

      <div className="flex gap-4">
        {reel.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reel.thumbnail_url}
            alt=""
            className="h-32 w-32 shrink-0 rounded object-cover"
          />
        )}
        <div className="flex flex-col gap-1">
          {reel.owner_username && (
            <a
              href={`https://instagram.com/${reel.owner_username}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium hover:underline"
            >
              @{reel.owner_username}
            </a>
          )}
          <a
            href={reel.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:underline"
          >
            View on Instagram
          </a>
          <p className="text-xs text-muted-foreground">
            Posted {formatDate(reel.posted_at)}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Views</p>
            <p className="text-lg font-medium">
              {reel.views.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Likes</p>
            <p className="text-lg font-medium">
              {reel.likes.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Comments</p>
            <p className="text-lg font-medium">
              {reel.comments_count.toLocaleString()} (
              {(commentRate * 100).toFixed(2)}%)
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Shares</p>
            <p className="text-lg font-medium">
              {reel.shares_count != null
                ? `${reel.shares_count.toLocaleString()} (${((shareRate ?? 0) * 100).toFixed(2)}%)`
                : "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      {reel.caption && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-1 text-xs text-muted-foreground">Caption</p>
            <p className="whitespace-pre-wrap text-sm">{reel.caption}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Transcript</p>
            {reel.transcription_status === "processing" && (
              <Badge variant="outline">Processing...</Badge>
            )}
            {reel.transcription_status === "ready" && (
              <Badge variant="secondary">Ready</Badge>
            )}
            {reel.transcription_status === "error" && (
              <Badge variant="destructive">Error</Badge>
            )}
          </div>

          {!reel.transcription_status && (
            <>
              <p className="text-sm text-muted-foreground">
                Not transcribed yet.
              </p>
              <TranscribeButton reelId={reel.id} />
            </>
          )}

          {reel.transcription_status === "processing" && (
            <>
              <p className="text-sm text-muted-foreground">
                Still processing — this can take up to a minute or two.
              </p>
              <RefreshStatusButton reelId={reel.id} />
            </>
          )}

          {reel.transcription_status === "error" && (
            <>
              <p className="text-sm text-destructive">
                {reel.transcription_error || "Transcription failed."}
              </p>
              <TranscribeButton reelId={reel.id} />
            </>
          )}

          {reel.transcription_status === "ready" && (
            <p className="whitespace-pre-wrap text-sm">
              {reel.transcript || "(empty transcript)"}
            </p>
          )}
        </CardContent>
      </Card>

      {reel.transcription_status === "ready" && (
        <AnalysisPanel
          reelId={reel.id}
          hookPatterns={hookPatterns ?? []}
          frameworks={frameworks ?? []}
          savedHook={
            savedHookRow
              ? {
                  hookText: savedHookRow.hook_text,
                  patternId: savedHookRow.pattern_id,
                  emotionalMechanism: savedHookRow.emotional_mechanism,
                  ctaUsed: savedHookRow.cta_used,
                  whyItWorked: savedHookRow.why_it_worked,
                }
              : null
          }
          savedFrameworkExample={
            savedFrameworkExampleRow
              ? {
                  frameworkId: savedFrameworkExampleRow.framework_id,
                  note: savedFrameworkExampleRow.note,
                }
              : null
          }
          pendingAnalysis={
            reel.analysis_status === "ready"
              ? (reel.analysis_result as unknown as ReelAnalysis)
              : null
          }
          analysisStatus={reel.analysis_status}
          analysisError={reel.analysis_error}
        />
      )}
    </div>
  );
}
