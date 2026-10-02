"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelCover } from "@/components/reel-thumb";
import { ActionDialog } from "@/components/action-dialog";
import { deleteBoard, renameBoard } from "@/app/reels/boards-actions";

export type BoardReel = {
  id: string;
  hook: string;
  thumbnailUrl: string | null;
  owner: string | null;
  postedAt: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number | null;
  durationSeconds: number | null;
};

function fmtN(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k";
  return Math.round(n).toLocaleString("en-US");
}

function fmtLen(seconds: number | null) {
  if (seconds == null) return "—";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function fmtShortDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}

const headerBtn =
  "flex h-[38px] flex-none items-center gap-1.5 rounded-md border border-[#E4E4E2] bg-white px-3.5 text-[13px] font-bold whitespace-nowrap hover:border-[#0D0D0D]";

export function BoardClient({
  board,
  reels,
  lastAdded,
}: {
  board: { id: string; name: string; isFavorites: boolean };
  reels: BoardReel[];
  lastAdded: string | null;
}) {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  function handleRename() {
    const name = window.prompt("Board name", board.name);
    if (!name || !name.trim() || name.trim() === board.name) return;
    renameBoard(board.id, name)
      .then(() => router.refresh())
      .catch(() => setError("Couldn't rename the board."));
  }

  function handleDelete() {
    deleteBoard(board.id)
      .then(() => router.push("/reels"))
      .catch(() => setError("Couldn't delete the board."));
    setConfirmingDelete(false);
  }

  return (
    <>
      <div className="flex flex-col gap-3.5">
        <Link
          href="/reels"
          className="flex items-center gap-1 self-start text-[13px] font-bold text-[#4a4a48] hover:text-[#FF1F8F]"
        >
          <MaterialIcon name="arrow_back" size={17} />
          All Reels
        </Link>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <h1 className="text-[64px] leading-[0.95] font-black tracking-[-0.04em]">
              {board.name}
              <span className="ml-1 inline-block size-3 rounded-full bg-[#FF1F8F] align-baseline" />
            </h1>
            <p className="mt-2 text-[15px] font-medium text-[#4a4a48]">
              {reels.length} {reels.length === 1 ? "reel" : "reels"}
              {lastAdded ? ` · Last added ${fmtShortDate(lastAdded)}` : ""}
            </p>
          </div>
          {!board.isFavorites && (
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={handleRename} className={headerBtn}>
                <MaterialIcon name="edit" size={17} />
                Rename
              </button>
              <button type="button" onClick={() => setConfirmingDelete(true)} className={headerBtn}>
                <MaterialIcon name="delete" size={17} />
                Delete Board
              </button>
            </div>
          )}
        </div>
        {error && <p className="text-sm font-semibold text-[#D10A6E]">{error}</p>}
      </div>

      {reels.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-[#F0F0F1] bg-white px-6 py-7 text-sm font-semibold text-[#4a4a48] shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
          <MaterialIcon name="folder_open" size={22} className="text-[#0D0D0D]" />
          Nothing here yet. Check reels in All Reels and use Add to board.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
          {reels.map((r) => (
            <div
              key={r.id}
              className="flex flex-col overflow-hidden rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]"
            >
              <div className="relative aspect-[4/5] bg-[#2b2b29]">
                <ReelCover url={r.thumbnailUrl} iconSize={36} />
                {board.isFavorites && (
                  <span className="absolute top-2.5 right-2.5 flex size-[30px] items-center justify-center rounded-full bg-white">
                    <span className="msym select-none text-[#FF1F8F]" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1, 'wght' 300" }}>
                      star
                    </span>
                  </span>
                )}
                <span className="absolute right-2.5 bottom-2.5 rounded bg-[#0D0D0D] px-1.5 py-0.5 text-[11px] font-bold text-white">
                  {fmtLen(r.durationSeconds)}
                </span>
              </div>
              <div className="flex flex-col gap-2.5 px-3.5 pt-3 pb-3.5">
                <div className="flex flex-col gap-0.5">
                  <Link
                    href={`/analyze-reel/reel/${r.id}`}
                    className="line-clamp-3 text-sm leading-[1.3] font-bold hover:text-[#FF1F8F]"
                  >
                    {r.hook || "(no caption)"}
                  </Link>
                  <span className="truncate text-xs font-semibold text-[#4a4a48]">
                    {r.owner ? `@${r.owner}` : "—"} · {fmtShortDate(r.postedAt)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 border-t border-[#F0F0F1] pt-2.5">
                  {(
                    [
                      ["visibility", fmtN(r.views)],
                      ["favorite", fmtN(r.likes)],
                      ["chat_bubble", fmtN(r.comments)],
                      ["send", r.shares == null ? "—" : fmtN(r.shares)],
                    ] as const
                  ).map(([icon, value]) => (
                    <span key={icon} className="flex flex-col gap-0.5">
                      <MaterialIcon name={icon} size={15} className="text-[#4a4a48]" />
                      <span className="text-[12.5px]">{value}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmingDelete && (
        <ActionDialog
          title={`Delete "${board.name}"?`}
          onClose={() => setConfirmingDelete(false)}
          confirmLabel="Delete Board"
          onConfirm={handleDelete}
        >
          <div className="px-6 py-4 text-sm font-medium text-[#4a4a48]">
            The board goes away, but its reels stay in All Reels.
          </div>
        </ActionDialog>
      )}
    </>
  );
}
