"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelCover } from "@/components/reel-thumb";
import { ActionDialog, NameDialog } from "@/components/action-dialog";
import { addReelsToBoard, deleteBoard, listAddableReels, removeFromBoard, renameBoard, reorderBoard } from "@/app/reels/boards-actions";

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
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState(reels);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [dragId, setDragId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [candidates, setCandidates] = useState<{ id: string; text: string; thumbnailUrl: string | null; owner: string | null }[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setItems(reels), [reels]);
  useEffect(() => {
    try {
      if (localStorage.getItem("rc-board-view") === "list") setView("list");
    } catch {}
  }, []);

  function pickView(v: "grid" | "list") {
    setView(v);
    try {
      localStorage.setItem("rc-board-view", v);
    } catch {}
  }

  function handleRename(name: string) {
    setRenaming(false);
    if (name === board.name) return;
    renameBoard(board.id, name)
      .then(() => router.refresh())
      .catch(() => setError("Couldn't rename the board."));
  }

  function openAdd() {
    setAdding(true);
    setPicked(new Set());
    setSearch("");
    setCandidates(null);
    listAddableReels(board.id)
      .then(setCandidates)
      .catch(() => {
        setAdding(false);
        setError("Couldn't load your reels.");
      });
  }

  function handleAdd() {
    const ids = [...picked];
    if (ids.length === 0) return;
    setSaving(true);
    addReelsToBoard(board.id, ids)
      .then(() => {
        setAdding(false);
        router.refresh();
      })
      .catch(() => setError("Couldn't add those reels."))
      .finally(() => setSaving(false));
  }

  function handleDelete() {
    deleteBoard(board.id)
      .then(() => router.push("/reels"))
      .catch(() => setError("Couldn't delete the board."));
    setConfirmingDelete(false);
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id));
    removeFromBoard(board.id, id)
      .then(() => router.refresh())
      .catch(() => setError("Couldn't remove the reel."));
  }

  function dragOver(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setItems((prev) => {
      const from = prev.findIndex((r) => r.id === dragId);
      const to = prev.findIndex((r) => r.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  }

  function dragEnd() {
    if (!dragId) return;
    setDragId(null);
    reorderBoard(
      board.id,
      items.map((r) => r.id),
    ).catch(() => setError("Couldn't save the new order."));
  }

  function open(id: string) {
    router.push(`/analyze-reel/reel/${id}`);
  }

  const dragProps = (id: string) => ({
    draggable: true,
    onDragStart: () => setDragId(id),
    onDragEnter: () => dragOver(id),
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDragEnd: dragEnd,
    onClick: () => open(id),
  });

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
            <h1 className="text-[34px] md:text-[64px] leading-[0.95] font-black tracking-[-0.04em]">
              {board.name}
              <span className="ml-1 inline-block size-2 md:size-3 rounded-full bg-[#FF1F8F] align-baseline" />
            </h1>
            <p className="mt-1 text-[13.5px] md:mt-2 md:text-[15px] font-medium text-[#4a4a48]">
              {items.length} {items.length === 1 ? "reel" : "reels"}
              {lastAdded ? ` · Last added ${fmtShortDate(lastAdded)}` : ""}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={openAdd} className={headerBtn}>
              <MaterialIcon name="add" size={18} />
              Add Reels
            </button>
            <div className="flex h-[38px] overflow-hidden rounded-md border border-[#E4E4E2] bg-white">
              {(["grid", "list"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => pickView(v)}
                  title={v === "grid" ? "Grid view" : "List view"}
                  aria-label={v === "grid" ? "Grid view" : "List view"}
                  className="flex w-10 items-center justify-center hover:text-[#FF1F8F]"
                  style={{ background: view === v ? "#F0F0F1" : undefined }}
                >
                  <MaterialIcon name={v === "grid" ? "grid_view" : "view_list"} size={18} />
                </button>
              ))}
            </div>
            {!board.isFavorites && (
              <>
                <button type="button" onClick={() => setRenaming(true)} className={headerBtn}>
                  <MaterialIcon name="edit" size={17} />
                  Rename
                </button>
                <button type="button" onClick={() => setConfirmingDelete(true)} className={headerBtn}>
                  <MaterialIcon name="delete" size={17} />
                  Delete Board
                </button>
              </>
            )}
          </div>
        </div>
        {error && <p className="text-sm font-semibold text-[#D10A6E]">{error}</p>}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-[#F0F0F1] bg-white px-6 py-7 text-sm font-semibold text-[#4a4a48] shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
          <MaterialIcon name="folder_open" size={22} className="text-[#0D0D0D]" />
          Nothing here yet. Check reels in All Reels and use Add to board.
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] md:gap-5">
          {items.map((r) => (
            <div
              key={r.id}
              {...dragProps(r.id)}
              className="group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]"
              style={{ opacity: dragId === r.id ? 0.4 : 1 }}
            >
              <div className="relative aspect-[4/5] bg-[#2b2b29] max-md:aspect-square">
                <ReelCover url={r.thumbnailUrl} iconSize={36} />
                {board.isFavorites && (
                  <span className="absolute top-1.5 right-1.5 flex size-[26px] items-center md:top-2.5 md:right-2.5 md:size-[30px] justify-center rounded-full bg-white">
                    <span
                      className="msym select-none text-[#FF1F8F]"
                      style={{ fontSize: 18, fontVariationSettings: "'FILL' 1, 'wght' 300" }}
                    >
                      favorite
                    </span>
                  </span>
                )}
                <RemoveButton
                  onClick={() => remove(r.id)}
                  className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 max-md:opacity-100 md:top-2.5 md:left-2.5"
                />
                <span className="absolute right-1.5 bottom-1.5 rounded bg-[#0D0D0D] px-1.5 py-0.5 text-[11px] font-bold text-white md:right-2.5 md:bottom-2.5">
                  {fmtLen(r.durationSeconds)}
                </span>
              </div>
              <div className="flex flex-col gap-2 px-2.5 pt-2 pb-2.5 md:gap-2.5 md:px-3.5 md:pt-3 md:pb-3.5">
                <div className="flex flex-col gap-0.5">
                  <span className="line-clamp-2 text-[12.5px] leading-[1.3] font-bold group-hover:text-[#FF1F8F] md:line-clamp-3 md:text-sm">
                    {r.hook || "(no caption)"}
                  </span>
                  <span className="truncate text-xs font-semibold text-[#4a4a48]">
                    {r.owner ? `@${r.owner}` : "—"} · {fmtShortDate(r.postedAt)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 border-t border-[#F0F0F1] pt-2 md:gap-1.5 md:pt-2.5">
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
                      <span className="text-[11px] md:text-[12.5px]">{value}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col overflow-hidden rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
          {items.map((r) => (
            <div
              key={r.id}
              {...dragProps(r.id)}
              className="group flex cursor-pointer items-center gap-3 border-b border-[#F0F0F1] px-3 py-2.5 last:border-b-0 hover:bg-[#FBFBFA] md:gap-4 md:px-5"
              style={{ opacity: dragId === r.id ? 0.4 : 1 }}
            >
              <span className="relative h-14 w-11 flex-none overflow-hidden rounded bg-[#2b2b29] md:h-[60px] md:w-12">
                <ReelCover url={r.thumbnailUrl} iconSize={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-bold group-hover:text-[#FF1F8F] max-md:line-clamp-2 max-md:text-[13px] max-md:leading-[1.3] md:truncate">{r.hook || "(no caption)"}</span>
                <span className="truncate text-xs font-semibold text-[#4a4a48]">
                  {r.owner ? `@${r.owner}` : "—"} · {fmtShortDate(r.postedAt)}
                </span>
                <span className="mt-0.5 flex items-center gap-3 text-[11px] md:hidden">
                  {(
                    [
                      ["visibility", fmtN(r.views)],
                      ["favorite", fmtN(r.likes)],
                      ["chat_bubble", fmtN(r.comments)],
                      ["send", r.shares == null ? "—" : fmtN(r.shares)],
                      ["schedule", fmtLen(r.durationSeconds)],
                    ] as const
                  ).map(([icon, value]) => (
                    <span key={icon} className="flex items-center gap-0.5">
                      <MaterialIcon name={icon} size={12} className="text-[#4a4a48]" />
                      {value}
                    </span>
                  ))}
                </span>
              </span>
              <span className="w-12 flex-none text-[13px] max-md:hidden">{fmtLen(r.durationSeconds)}</span>
              {(
                [
                  ["Views", fmtN(r.views)],
                  ["Likes", fmtN(r.likes)],
                  ["Comments", fmtN(r.comments)],
                  ["Shares", r.shares == null ? "—" : fmtN(r.shares)],
                ] as const
              ).map(([label, value]) => (
                <span key={label} className="hidden w-[72px] flex-none flex-col gap-0.5 md:flex">
                  <span className="text-[11px] font-bold text-[#4a4a48]">{label}</span>
                  <span className="text-[13px]">{value}</span>
                </span>
              ))}
              <RemoveButton onClick={() => remove(r.id)} className="opacity-0 group-hover:opacity-100 max-md:opacity-100" light />
            </div>
          ))}
        </div>
      )}

      {adding && (
        <ActionDialog
          title={`Add Reels To ${board.name}`}
          onClose={() => setAdding(false)}
          confirmLabel={saving ? "Adding…" : picked.size ? `Add ${picked.size}` : "Add"}
          confirmDisabled={picked.size === 0 || saving}
          onConfirm={handleAdd}
        >
          <div className="px-6 pt-1 pb-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reels or creators…"
              className="h-10 w-full rounded-md border border-[#E4E4E2] px-3 text-sm font-medium outline-none focus:border-[#0D0D0D]"
            />
          </div>
          {candidates === null ? (
            <div className="px-6 py-6 text-sm font-semibold text-[#4a4a48]">Loading your reels…</div>
          ) : (
            (() => {
              const q = search.trim().toLowerCase();
              const list = candidates.filter((c) => !q || c.text.toLowerCase().includes(q) || (c.owner ?? "").toLowerCase().includes(q));
              if (list.length === 0)
                return <div className="px-6 py-6 text-sm font-semibold text-[#4a4a48]">{candidates.length === 0 ? "Every reel is already on this board." : "No reels match."}</div>;
              return list.map((c) => {
                const on = picked.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setPicked((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.id)) next.delete(c.id);
                        else next.add(c.id);
                        return next;
                      })
                    }
                    className="flex items-center gap-3 px-6 py-2 text-left hover:bg-[#F6F6F5]"
                    style={{ background: on ? "#F0F0F1" : undefined }}
                  >
                    <span
                      className="flex size-4 flex-none items-center justify-center rounded-[3px] border-[1.5px]"
                      style={{ background: on ? "#0D0D0D" : "#FFFFFF", borderColor: on ? "#0D0D0D" : "#BDBDBB" }}
                    >
                      {on && <MaterialIcon name="check" size={12} className="text-white" />}
                    </span>
                    <span className="relative h-11 w-9 flex-none overflow-hidden rounded bg-[#2b2b29]">
                      <ReelCover url={c.thumbnailUrl} iconSize={14} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="line-clamp-2 text-[13px] leading-[1.3] font-bold">{c.text || "(no caption)"}</span>
                      <span className="truncate text-xs font-semibold text-[#4a4a48]">{c.owner ? `@${c.owner}` : "—"}</span>
                    </span>
                  </button>
                );
              });
            })()
          )}
        </ActionDialog>
      )}

      {renaming && (
        <NameDialog title="Rename board" initial={board.name} confirmLabel="Save" onClose={() => setRenaming(false)} onSubmit={handleRename} />
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

function RemoveButton({ onClick, className = "", light }: { onClick: () => void; className?: string; light?: boolean }) {
  return (
    <button
      type="button"
      title="Remove from this board"
      aria-label="Remove from this board"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex size-7 flex-none items-center justify-center rounded-full transition-opacity ${
        light
          ? "text-[#4a4a48] hover:bg-[#F0F0F1] hover:text-[#0D0D0D]"
          : "bg-white text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-white"
      } ${className}`}
    >
      <MaterialIcon name="close" size={16} />
    </button>
  );
}
