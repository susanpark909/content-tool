import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/page-shell";
import { LibraryClient, type LibraryRow } from "./library-client";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const supabase = await createClient();

  const { data: reels, error } = await supabase
    .from("ct_reels")
    .select(
      "id, url, owner_username, owner_avatar_url, hook_text, body_text, cta_text, transcript, caption, posted_at, views, likes, comments_count, shares_count, goal, duration_seconds",
    )
    .not("hook_text", "is", null)
    .order("views", { ascending: false });

  const rows: LibraryRow[] = (reels ?? []).map((r) => ({
    id: r.id,
    url: r.url,
    ownerUsername: r.owner_username,
    ownerAvatarUrl: r.owner_avatar_url,
    hookText: r.hook_text ?? "",
    bodyText: r.body_text,
    ctaText: r.cta_text,
    transcript: (r.transcript as string | null)?.trim() || null,
    caption: r.caption,
    postedAt: r.posted_at,
    views: r.views,
    likes: r.likes,
    commentsCount: r.comments_count,
    sharesCount: r.shares_count,
    goal: r.goal as LibraryRow["goal"],
    durationSeconds: r.duration_seconds,
  }));

  return (
    <PageShell>
      <div>
        <h1 className="text-[34px] md:text-[64px] leading-[0.95] font-black tracking-[-0.04em]">
          Library
          <span className="ml-1 inline-block size-2 md:size-3 rounded-full bg-[#C6FF3D] align-baseline" />
        </h1>
        <p className="mt-1 text-[13.5px] md:mt-2 md:text-[15px] font-medium text-[#4a4a48]">
          Your personal swipe file.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          Couldn&apos;t load the Library: {error.message}
        </p>
      )}
      <LibraryClient rows={rows} />
    </PageShell>
  );
}
