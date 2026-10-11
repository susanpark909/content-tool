"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelThumb } from "@/components/reel-thumb";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { addLinksToQueue, removeFromQueue, startQueueAnalysis } from "./queue-actions";

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
  postType?: string | null;
  analyzing?: boolean;
};

// Paste one or more reel links to add them to the Queue by hand.
export function AddToQueue() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function add() {
    if (!value.trim() || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await addLinksToQueue(value);
      const parts = [];
      if (r.added) parts.push(`${r.added} added`);
      if (r.skipped) parts.push(`${r.skipped} already saved`);
      if (r.invalid) parts.push(`${r.invalid} not a reel link`);
      const msg = parts.join(" · ") || "Nothing to add";
      setNote(msg);
      setTimeout(() => setNote((n) => (n === msg ? null : n)), 10000);
      if (r.added || r.skipped) setValue("");
      router.refresh();
    } catch (e) {
      const msg = e instanceof TypeError ? "Lost the connection. Refresh to see if it was added." : "Couldn't add that. Try again.";
      setNote(msg);
      setTimeout(() => setNote((n) => (n === msg ? null : n)), 10000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-[#E4E4E2] bg-white px-2.5 focus-within:border-[#0D0D0D]">
          <MaterialIcon name="link" size={18} className="text-[#4a4a48]" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Paste a reel link to add"
            inputMode="url"
            autoComplete="off"
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-medium outline-none"
          />
        </div>
        <button
          type="button"
          disabled={busy || !value.trim()}
          onClick={add}
          className="flex h-9 flex-none items-center gap-1.5 rounded-md bg-[#FF1F8F] px-3.5 text-[12.5px] font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:bg-[#E4E4E2] disabled:text-[#9a9a98] disabled:hover:bg-[#E4E4E2] disabled:hover:text-[#9a9a98]"
        >
          {busy ? <EqualizerIcon size={14} /> : <MaterialIcon name="add" size={16} weight={500} />}
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {note && <span className="text-xs font-semibold text-[#4a4a48]">{note}</span>}
    </div>
  );
}

function fmtN(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
}

function fmtLen(sec: number) {
  const m = Math.floor(sec / 60);
  return `${m}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
}

// A shared link was saved a moment ago and its numbers are still being fetched.
function gettingNumbers(r: QueueRow) {
  return r.postType == null && r.views == null && r.likes == null && Date.now() - new Date(r.createdAt).getTime() < 3 * 60 * 1000;
}

function shortDate(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

// Reels shared from the phone are just saved links. Tick the ones you want and
// press Analyze - that's the step that costs scraper credit. Older rows that
// already have their numbers are added to All Reels for free.
export function QueueClient({ rows: initialRows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  useEffect(() => setRows(initialRows), [initialRows]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workingIds, setWorkingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const busy = progress !== null;
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function announce(message: string) {
    setToast(message);
    setTimeout(() => setToast((t) => (t === message ? null : t)), 5000);
  }

  function drop(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Analyze runs on the server, so it keeps going even if you leave this page. Here we just start it,
  // clear the selection, and show each reel as "Analyzing" until the server says it's done.
  async function analyzeSelected() {
    const ids = rows.filter((r) => selected.has(r.id)).map((r) => r.id);
    if (ids.length === 0 || busy) return;
    setError(null);
    setProgress({ done: 0, total: ids.length });
    setWorkingIds(new Set(ids));
    setSelected(new Set());
    try {
      await startQueueAnalysis(ids);
      announce(ids.length === 1 ? "Analyzing. It keeps going if you leave this page." : `Analyzing ${ids.length} reels. It keeps going if you leave this page.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the analysis");
      setWorkingIds(new Set());
    } finally {
      setProgress(null);
    }
  }

  // while anything is being analyzed (from this page or another device), keep refreshing until it's done
  const anyAnalyzing = rows.some((r) => r.analyzing || gettingNumbers(r)) || workingIds.size > 0;
  useEffect(() => {
    if (!anyAnalyzing) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [anyAnalyzing, router]);
  // once the server says they're no longer analyzing, drop the local marks
  useEffect(() => {
    setWorkingIds((prev) => {
      if (prev.size === 0) return prev;
      const still = new Set([...prev].filter((id) => rows.some((r) => r.id === id && r.analyzing)));
      return still.size === prev.size ? prev : still;
    });
  }, [rows]);

  async function removeSelected() {
    const ids = [...selected];
    ids.forEach(drop);
    await Promise.allSettled(ids.map((id) => removeFromQueue(id)));
  }

  return (
    <div className="flex flex-col">
      {error && <p className="pb-2 text-[13px] font-semibold text-[#D10A6E]">{error}</p>}

      <div className="flex min-h-9 items-center gap-2 pb-2">
        <button
          type="button"
          onClick={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
          className="flex items-center gap-2 text-xs font-bold text-[#4a4a48]"
        >
          <Box on={allSelected} some={selected.size > 0 && !allSelected} />
          {selected.size > 0 ? `${selected.size} selected` : "Select all"}
        </button>
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={removeSelected}
              title="Remove selected"
              aria-label="Remove selected"
              className="flex size-8 items-center justify-center rounded-md border border-[#E4E4E2] text-[#4a4a48] hover:border-[#0D0D0D] disabled:opacity-50"
            >
              <MaterialIcon name="delete" size={17} />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={analyzeSelected}
              className="flex h-8 items-center gap-1.5 rounded-md bg-[#FF1F8F] px-3 text-[12.5px] font-extrabold whitespace-nowrap text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-70"
            >
              {progress ? <EqualizerIcon size={15} /> : <MaterialIcon name="bolt" size={16} weight={500} />}
              {progress ? `Analyzing ${progress.done + 1} of ${progress.total}…` : `Analyze (${selected.size})`}
            </button>
          </div>
        )}
      </div>

      {rows.map((r) => {
        const on = selected.has(r.id);
        return (
          <div
            key={r.id}
            className="flex items-center gap-2.5 border-t border-[#F0F0F1] py-2"
            style={{ background: on ? "#FBFBFA" : undefined }}
          >
            {/* moving bars show which reel is being analyzed right now */}
            <button type="button" onClick={() => toggle(r.id)} aria-label="Select reel" className="flex-none">
              <Box on={on} />
            </button>
            <a href={r.url} target="_blank" rel="noopener noreferrer" title="Open on Instagram" className="flex-none">
              <ReelThumb url={r.thumbnailUrl} />
            </a>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="line-clamp-2 text-[13px] leading-[1.3] font-bold">{r.caption || "Reel link saved"}</span>
              <span className="truncate text-[11.5px] font-medium text-[#4a4a48]">
                {r.ownerUsername ? `@${r.ownerUsername}` : "Link only"}
                {r.createdAt ? ` · ${shortDate(r.createdAt)}` : ""}
              </span>
              {gettingNumbers(r) ? (
                <span className="flex items-center gap-1 text-[11.5px] font-semibold text-[#9a9a98]">
                  <EqualizerIcon size={11} /> Getting the numbers…
                </span>
              ) : (
                (r.views != null || r.likes != null || r.commentsCount != null || r.durationSeconds != null || r.postType === "carousel") && (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] font-bold text-[#4a4a48] [font-variant-numeric:tabular-nums]">
                    {r.postType === "carousel" && (
                      <span className="flex items-center gap-1 text-[#2F6BFF]" title="Carousel">
                        <MaterialIcon name="collections" size={13} /> Carousel
                      </span>
                    )}
                    {r.views != null && (
                      <span className="flex items-center gap-1" title="Views">
                        <MaterialIcon name="visibility" size={13} /> {fmtN(r.views)}
                      </span>
                    )}
                    {r.likes != null && (
                      <span className="flex items-center gap-1" title="Likes">
                        <MaterialIcon name="favorite" size={13} /> {fmtN(r.likes)}
                      </span>
                    )}
                    {r.commentsCount != null && (
                      <span className="flex items-center gap-1" title="Comments">
                        <MaterialIcon name="comment" size={13} /> {fmtN(r.commentsCount)}
                      </span>
                    )}
                    {r.durationSeconds != null && (
                      <span className="flex items-center gap-1" title="Length">
                        <MaterialIcon name="av_timer" size={13} /> {fmtLen(r.durationSeconds)}
                      </span>
                    )}
                  </span>
                )
              )}
            </div>
            {(workingIds.has(r.id) || r.analyzing) && (
              <span className="flex h-6 flex-none items-center gap-1 rounded-full bg-[#FFD9EB] px-2 text-[11px] font-bold text-[#FF1F8F]">
                <EqualizerIcon size={12} />
                Analyzing
              </span>
            )}
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

function Box({ on, some }: { on: boolean; some?: boolean }) {
  const filled = on || some;
  return (
    <span
      className="flex size-4 items-center justify-center rounded-[3px] border-[1.5px]"
      style={{ background: filled ? "#0D0D0D" : "#FFFFFF", borderColor: filled ? "#0D0D0D" : "#BDBDBB" }}
    >
      {filled && <MaterialIcon name={on ? "check" : "remove"} size={12} className="text-white" />}
    </span>
  );
}
