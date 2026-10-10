"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ReelCover } from "@/components/reel-thumb";
import { NameDialog } from "@/components/action-dialog";
import { createBoard } from "@/app/reels/boards-actions";

export type BoardCard = { id: string; name: string; isFavorites: boolean; count: number; thumbs: (string | null)[] };

export function BoardsIndexClient({ boards }: { boards: BoardCard[] }) {
  const router = useRouter();
  const [naming, setNaming] = useState(false);

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
          <Link key={b.id} href={`/boards/${b.id}`} className="group flex min-w-0 flex-col gap-2.5">
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
