"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelCover } from "@/components/reel-thumb";
import { NameDialog } from "@/components/action-dialog";
import { createBoard, reorderBoards } from "@/app/reels/boards-actions";

export type BoardCard = { id: string; name: string; isFavorites: boolean; count: number; thumbs: (string | null)[] };

export function BoardsIndexClient({ boards: initial }: { boards: BoardCard[] }) {
  const router = useRouter();
  const [naming, setNaming] = useState(false);
  const [boards, setBoards] = useState(initial);
  useEffect(() => setBoards(initial), [initial]);
  // drag a board to move it; a thin line shows where it will land (Favorites stays first)
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(null);

  function dropOn() {
    if (!dragId || !drop) return;
    const rest = boards.filter((b) => b.id !== dragId);
    const moved = boards.find((b) => b.id === dragId);
    if (!moved || moved.isFavorites) return;
    let at = rest.findIndex((b) => b.id === drop.id) + (drop.after ? 1 : 0);
    if (rest[0]?.isFavorites) at = Math.max(at, 1);
    const next = [...rest.slice(0, at), moved, ...rest.slice(at)];
    setBoards(next);
    reorderBoards(next.map((b) => b.id)).catch(() => router.refresh());
  }

  async function create(name: string) {
    setNaming(false);
    try {
      const b = await createBoard(name);
      router.push(`/boards/${b.id}`);
    } catch {
      router.refresh();
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:gap-6">
        {boards.map((b) => (
          <Link
            key={b.id}
            href={`/boards/${b.id}`}
            draggable={!b.isFavorites}
            onDragStart={(e) => {
              setDragId(b.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => {
              setDragId(null);
              setDrop(null);
            }}
            onDragOver={(e) => {
              if (!dragId || dragId === b.id) return;
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              const after = e.clientX > r.left + r.width / 2;
              if (drop?.id !== b.id || drop.after !== after) setDrop({ id: b.id, after });
            }}
            onDrop={(e) => {
              e.preventDefault();
              dropOn();
              setDragId(null);
              setDrop(null);
            }}
            className={`group relative flex min-w-0 flex-col gap-2.5 ${dragId === b.id ? "opacity-40" : ""}`}
          >
            {drop?.id === b.id && dragId && (
              <span
                className={`pointer-events-none absolute top-0 bottom-8 z-10 w-[3px] rounded-full bg-[#E6FF00] shadow-[0_0_0_0.5px_rgba(13,13,13,0.25),0_0_8px_rgba(230,255,0,0.9)] ${drop.after ? "-right-[9px] md:-right-[14px]" : "-left-[9px] md:-left-[14px]"}`}
              />
            )}
            <div
              className="grid aspect-video grid-cols-[2fr_1fr] grid-rows-2 gap-[3px] overflow-hidden rounded-xl border-2 bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)] transition-all group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_28px_rgba(13,13,13,0.16)]"
              style={{ borderColor: b.isFavorites ? "#FF1F8F" : "#F0F0F1" }}
            >
              <div className="relative row-span-2 bg-[#2b2b29]">
                <ReelCover url={b.thumbs[0] ?? null} showPlay={false} />
              </div>
              <div className="relative bg-[#5a4a52]">
                <ReelCover url={b.thumbs[1] ?? null} showPlay={false} />
              </div>
              <div className="relative bg-[#3f4a44]">
                <ReelCover url={b.thumbs[2] ?? null} showPlay={false} />
              </div>
            </div>
            <div className="flex min-w-0 items-baseline justify-between gap-2 px-0.5">
              <span className="truncate text-[15px] font-extrabold">{b.name}</span>
              <span className="text-xs font-semibold whitespace-nowrap text-[#4a4a48]">
                {b.count} {b.count === 1 ? "reel" : "reels"}
              </span>
            </div>
          </Link>
        ))}
        <button type="button" onClick={() => setNaming(true)} className="flex flex-col gap-2.5 text-left">
          <div className="flex aspect-video flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed border-[#BDBDBB] text-sm font-bold text-[#4a4a48] hover:border-[#FF1F8F] hover:text-[#0D0D0D]">
            <MaterialIcon name="add" size={26} />
            New Board
          </div>
        </button>
      </div>
      {naming && <NameDialog title="Create board" confirmLabel="Create" onClose={() => setNaming(false)} onSubmit={create} />}
    </>
  );
}
