import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/page-shell";
import { MaterialIcon } from "@/components/ui/material-icon";
import { AddToQueue, QueueClient, type QueueRow } from "@/app/analyze-reel/queue-client";

export const dynamic = "force-dynamic";

// Posts you saved (from the phone Shortcut or by pasting a link) that haven't been analyzed yet.
// Instagram for now; YouTube and TikTok will live here too.
export default async function PostQueuePage() {
  const supabase = await createClient();
  const [{ data: reels }, { data: queueItems, error }] = await Promise.all([
    supabase.from("ct_reels").select("url"),
    supabase
      .from("ct_reel_queue")
      .select(
        "id, url, status, caption, thumbnail_url, owner_username, posted_at, views, likes, comments_count, shares_count, reposts_count, saves_count, duration_seconds, error_message, created_at",
      )
      .order("created_at", { ascending: false }),
  ]);

  const savedUrls = new Set((reels ?? []).map((r) => r.url as string));
  const staleIds = (queueItems ?? []).filter((r) => savedUrls.has(r.url as string)).map((r) => r.id as string);
  if (staleIds.length > 0) await supabase.from("ct_reel_queue").delete().in("id", staleIds);

  const rows: QueueRow[] = (queueItems ?? [])
    .filter((r) => !savedUrls.has(r.url as string))
    .map((r) => ({
      id: r.id,
      url: r.url,
      status: r.status as QueueRow["status"],
      caption: r.caption,
      thumbnailUrl: r.thumbnail_url,
      ownerUsername: r.owner_username,
      postedAt: r.posted_at,
      views: r.views,
      likes: r.likes,
      commentsCount: r.comments_count,
      sharesCount: r.shares_count,
      repostsCount: r.reposts_count,
      savesCount: r.saves_count,
      durationSeconds: r.duration_seconds,
      errorMessage: r.error_message,
      createdAt: r.created_at,
    }));

  const platforms = [
    { label: "Instagram", icon: "photo_camera", on: true },
    { label: "YouTube", icon: "smart_display", on: false },
    { label: "TikTok", icon: "music_note", on: false },
  ];

  return (
    <PageShell>
      <div>
        <h1 className="text-[34px] leading-[0.95] font-black tracking-[-0.04em] md:text-[64px]">
          Post Queue
          <span className="ml-1 inline-block size-2 rounded-full bg-[#C6FF3D] align-baseline md:size-3" />
        </h1>
        <p className="mt-1 text-[13.5px] font-medium text-[#4a4a48] md:mt-2 md:text-[15px]">
          Save posts now. Pick the ones worth analyzing.
        </p>
      </div>

      <div className="flex w-fit max-w-full gap-1.5 overflow-x-auto rounded-xl border border-[#F0F0F1] bg-white p-1.5 shadow-[0_4px_16px_rgba(13,13,13,0.06)] [scrollbar-width:none]">
        {platforms.map((p) => (
          <span
            key={p.label}
            title={p.on ? undefined : "Coming soon"}
            className="flex h-11 flex-none items-center gap-2 rounded-lg px-5 text-[15px] font-bold whitespace-nowrap max-md:px-4 max-md:text-[14px]"
            style={{ background: p.on ? "#F0F0F1" : undefined, color: p.on ? "#0D0D0D" : "#9a9a98" }}
          >
            <MaterialIcon name={p.icon} size={20} className={p.on ? "text-[#FF1F8F]" : undefined} />
            {p.label}
            {p.on ? (
              <span className="rounded-full bg-white px-2 text-[12.5px] font-bold text-[#4a4a48]">{rows.length}</span>
            ) : (
              <span className="rounded-full bg-[#F0F0F1] px-2 text-[11px] font-bold">Soon</span>
            )}
          </span>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">Couldn&apos;t load the queue: {error.message}</p>}

      <div className="rounded-lg border border-[#F0F0F1] bg-white p-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:p-5">
        <AddToQueue />
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#F0F0F1] text-[#6b6b69]">
              <MaterialIcon name="inbox" size={24} />
            </span>
            <span className="text-[15px] font-extrabold">Your queue is empty</span>
            <span className="max-w-[320px] text-[13px] font-medium text-[#4a4a48]">Paste a link above, or share a post from Instagram with your Shortcut.</span>
          </div>
        ) : (
          <QueueClient key={rows.map((r) => r.id).join(",")} rows={rows} />
        )}
      </div>
    </PageShell>
  );
}
