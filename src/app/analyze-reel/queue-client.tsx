"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelThumb } from "@/components/reel-thumb";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { addLinksToQueue, analyzeQueueItem, removeFromQueue, sendToLibrary } from "./queue-actions";

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
      setNote(parts.join(" · ") || "Nothing to add");
      if (r.added || r.skipped) setValue("");
      router.refresh();
    } catch (e) {
      setNote(e instanceof TypeError ? "Lost the connection. Refresh to see if it was added." : "Couldn't add that. Try again.");
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
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

  async function analyzeSelected() {
    const todo = rows.filter((r) => selected.has(r.id));
    if (todo.length === 0 || busy) return;
    setError(null);
    setProgress({ done: 0, total: todo.length });
    let ok = 0;
    for (const row of todo) {
      setWorkingId(row.id);
      try {
        if (row.views != null) await sendToLibrary(row.id);
        else await analyzeQueueItem(row.id);
        drop(row.id);
        ok++;
      } catch (e) {
        // The connection can drop while the analysis keeps running on the server.
        setError(
          e instanceof TypeError
            ? "Lost the connection while waiting. It probably finished, and it will clear from the Queue when you refresh."
            : e instanceof Error
              ? e.message
              : "Something went wrong",
        );
        break;
      }
      setProgress({ done: ok, total: todo.length });
    }
    setProgress(null);
    setWorkingId(null);
    if (ok > 0) announce(ok === 1 ? "Analysis done" : `Analysis done for ${ok} reels`);
    router.refresh();
  }

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
            </div>
            {workingId === r.id && (
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
