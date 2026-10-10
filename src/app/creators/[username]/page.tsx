import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetch-all";
import { PageShell } from "@/components/ui/page-shell";
import { CreatorClient, type CreatorReel } from "./creator-client";

export const dynamic = "force-dynamic";

export default async function CreatorPage({ params }: { params: Promise<{ username: string }> }) {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw);
  const supabase = await createClient();

  const { data: reels, error } = await fetchAll((from, to) =>
    supabase
      .from("ct_reels")
      .select("id, url, caption, thumbnail_url, owner_avatar_url, posted_at, views, likes, comments_count, shares_count, reposts_count, saves_count, duration_seconds, transcription_status")
      .eq("owner_username", username)
      .order("posted_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
  if (!error && reels.length === 0) notFound();

  const rows: CreatorReel[] = reels.map((r) => ({
    id: r.id as string,
    url: r.url as string,
    caption: (r.caption as string | null) ?? "",
    thumbnailUrl: r.thumbnail_url as string | null,
    postedAt: r.posted_at as string | null,
    views: (r.views as number) ?? 0,
    likes: (r.likes as number) ?? 0,
    comments: (r.comments_count as number) ?? 0,
    shares: r.shares_count as number | null,
    reposts: r.reposts_count as number | null,
    saves: r.saves_count as number | null,
    durationSeconds: r.duration_seconds as number | null,
    // Scanned reels only have the basics; analyzed ones also have shares, saves, reposts.
    analyzed: r.shares_count != null || r.reposts_count != null || r.saves_count != null || r.transcription_status === "ready",
  }));
  const avatar = (reels.find((r) => r.owner_avatar_url)?.owner_avatar_url as string | undefined) ?? null;

  return (
    <PageShell>
      {error && <p className="text-sm text-destructive">Couldn&apos;t load this creator: {error.message}</p>}
      <CreatorClient username={username} avatar={avatar} reels={rows} />
    </PageShell>
  );
}
