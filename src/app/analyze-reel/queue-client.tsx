"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelThumb } from "@/components/reel-thumb";
import { analyzeQueueItem, removeFromQueue, sendToLibrary } from "./queue-actions";

export type QueueRow = {
  id: string;
  url: string;
  status: "pending" | "ready" | "error";
  caption: string | null;
  thumbnailUrl: string | null;
  ownerUsername: string | null;
  postedAt: string | null;
  views: number | null;
  likes: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  repostsCount: number | null;
  savesCount: number | null;
  durationSeconds: number | null;
  errorMessage: string | null;
  createdAt: string;
};

function shortDate(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

// Reels shared from the phone are just saved links until you press Analyze
// (that's the step that costs scraper credit). Older rows that already have
// their numbers can be added to All Reels for free.
export function QueueClient({ rows: initialRows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function announce(message: string) {
    setToast(message);
    setTimeout(() => setToast((t) => (t === message ? null : t)), 5000);
  }

  function drop(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function handleAnalyze(row: QueueRow) {
    setError(null);
    setBusyId(row.id);
    startTransition(async () => {
      try {
        if (row.views != null) {
          await sendToLibrary(row.id);
          announce("Added to All Reels");
        } else {
          const res = await analyzeQueueItem(row.id);
          announce(res.alreadySaved ? "Already in All Reels" : "Analysis done");
        }
        drop(row.id);
        router.refresh();
      } catch (e) {
        // The connection can drop while the analysis keeps running on the server.
        if (e instanceof TypeError) {
          setError("Lost the connection while waiting. It may have finished anyway, so check All Reels.");
          router.refresh();
        } else {
          setError(e instanceof Error ? e.message : "Something went wrong");
        }
      } finally {
        setBusyId(null);
      }
    });
  }

  function handleRemove(row: QueueRow) {
    setError(null);
    drop(row.id);
    startTransition(async () => {
      try {
        await removeFromQueue(row.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't remove it");
      }
    });
  }

  return (
    <div className="flex flex-col">
      {error && <p className="pb-2 text-[13px] font-semibold text-[#D10A6E]">{error}</p>}
      {rows.map((r) => {
        const busy = busyId === r.id;
        const hasStats = r.views != null;
        return (
          <div key={r.id} className="flex items-center gap-3 border-t border-[#F0F0F1] py-2.5 first:border-t-0 first:pt-0">
            <a href={r.url} target="_blank" rel="noopener noreferrer" title="Open on Instagram" className="flex-none">
              <ReelThumb url={r.thumbnailUrl} />
            </a>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="line-clamp-2 text-[13px] leading-[1.3] font-bold">{r.caption || "Reel link saved"}</span>
              <span className="truncate text-xs font-medium text-[#4a4a48]">
                {r.ownerUsername ? `@${r.ownerUsername}` : "Link only"}
                {r.createdAt ? ` · Added ${shortDate(r.createdAt)}` : ""}
              </span>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleAnalyze(r)}
              className="flex h-8 flex-none items-center gap-1.5 rounded-md bg-[#FF1F8F] px-3 text-[12.5px] font-extrabold whitespace-nowrap text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60"
            >
              <MaterialIcon name={hasStats ? "library_add" : "bolt"} size={16} weight={500} />
              {busy ? "Working…" : hasStats ? "Add to All Reels" : "Analyze"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleRemove(r)}
              title="Remove from queue"
              aria-label="Remove from queue"
              className="flex size-7 flex-none items-center justify-center rounded text-[#4a4a48] hover:bg-[#F0F0F1] hover:text-[#0D0D0D] disabled:opacity-50"
            >
              <MaterialIcon name="close" size={18} />
            </button>
          </div>
        );
      })}

      {toast && (
        <div className="fixed bottom-7 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2.5 rounded-md bg-[#0D0D0D] px-4.5 py-3 text-sm font-bold whitespace-nowrap text-[#FBFBFA] shadow-[0_12px_32px_rgba(13,13,13,0.2)]">
          <span className="size-2 rounded-full bg-[#C6FF3D]" />
          {toast}
        </div>
      )}
    </div>
  );
}
