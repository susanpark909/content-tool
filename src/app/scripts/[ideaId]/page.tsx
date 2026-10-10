import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadOutlierScorer } from "@/lib/creator-typicals";
import { getAllIdeas } from "@/app/idea/actions";
import { PageShell } from "@/components/ui/page-shell";
import { ScriptPageClient, type ScriptReel, type VaultHook } from "./script-page-client";

export const dynamic = "force-dynamic";

export default async function ScriptPage({ params }: { params: Promise<{ ideaId: string }> }) {
  const { ideaId } = await params;
  const ideas = await getAllIdeas();
  const idea = ideas.find((i) => i.id === ideaId);
  if (!idea) notFound();

  const supabase = await createClient();
  const scoreOf = await loadOutlierScorer(supabase);

  let reel: ScriptReel | null = null;
  if (idea.inspirationReelId) {
    const { data: r } = await supabase
      .from("ct_reels")
      .select(
        "id, url, caption, thumbnail_url, owner_username, posted_at, views, likes, comments_count, shares_count, reposts_count, saves_count, duration_seconds, transcript, hook_text, cta_text",
      )
      .eq("id", idea.inspirationReelId)
      .single();
    if (r) {
      reel = {
        id: r.id,
        url: r.url,
        caption: r.caption,
        thumbnailUrl: r.thumbnail_url,
        owner: r.owner_username,
        postedAt: r.posted_at,
        views: r.views ?? 0,
        likes: r.likes ?? 0,
        comments: r.comments_count ?? 0,
        shares: r.shares_count,
        reposts: r.reposts_count,
        saves: r.saves_count,
        durationSeconds: r.duration_seconds as number | null,
        transcript: r.transcript,
        hook: r.hook_text,
        cta: r.cta_text,
        outlier: scoreOf(r.owner_username as string | null, { views: r.views as number | null, comments: r.comments_count as number | null, shares: r.shares_count as number | null }),
      };
    }
  }

  const { data: hooks } = await supabase
    .from("ct_reels")
    .select("id, hook_text, owner_username, posted_at, views, comments_count, shares_count, reposts_count, saves_count, goals")
    .not("hook_text", "is", null)
    .order("views", { ascending: false })
    .limit(300);
  const vault: VaultHook[] = (hooks ?? []).map((h) => ({
    id: h.id as string,
    hook: (h.hook_text as string) ?? "",
    owner: h.owner_username as string | null,
    postedAt: (h.posted_at as string | null) ?? null,
    views: (h.views as number) ?? 0,
    comments: (h.comments_count as number) ?? 0,
    shares: h.shares_count as number | null,
    reposts: h.reposts_count as number | null,
    saves: h.saves_count as number | null,
    goals: ((h.goals as string[] | null) ?? []) as string[],
    outlier: scoreOf(h.owner_username as string | null, { views: h.views as number | null, comments: h.comments_count as number | null, shares: h.shares_count as number | null }),
  }));

  return (
    <PageShell>
      <ScriptPageClient idea={idea} reel={reel} vault={vault} />
    </PageShell>
  );
}
