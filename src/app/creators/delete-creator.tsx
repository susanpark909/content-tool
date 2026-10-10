"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { deleteCreator } from "./creator-actions";

// Delete a creator and all their saved posts, after a clear confirmation.
export function DeleteCreator({ username, posts }: { username: string; posts: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await deleteCreator(username);
      router.push("/creators");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete this creator");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        title="More"
        aria-label="More"
        onClick={() => {
          const r = btn.current?.getBoundingClientRect();
          if (r) setMenu({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 188)) });
        }}
        className="ml-1 inline-flex size-11 items-center justify-center rounded-full align-middle text-[#9a9a98] hover:bg-[#F0F0F1] hover:text-[#0D0D0D]"
      >
        <MaterialIcon name="more_horiz" size={28} />
      </button>
      {menu &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[80]" onClick={() => setMenu(null)} />
            <div style={{ top: menu.top, left: menu.left }} className="fixed z-[81] w-[180px] rounded-lg border border-[#E4E4E2] bg-white py-1 shadow-[0_12px_32px_rgba(13,13,13,0.18)]">
              <button
                type="button"
                onClick={() => {
                  setMenu(null);
                  setOpen(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold text-[#D10A6E] hover:bg-[#FFF0F7]"
              >
                <MaterialIcon name="delete" size={17} /> Delete creator
              </button>
            </div>
          </>,
          document.body,
        )}
      {open && (
        <div onClick={() => !busy && setOpen(false)} className="fixed inset-0 z-[110] flex items-center justify-center bg-[rgba(13,13,13,0.35)] p-4 backdrop-blur-[6px]">
          <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-[440px] flex-col gap-4 rounded-2xl border border-[#F0F0F1] bg-white p-5 shadow-[0_24px_72px_rgba(13,13,13,0.28)]">
            <span className="text-[22px] font-extrabold tracking-[-0.01em]">Delete @{username}?</span>
            <span className="text-[14px] leading-snug font-medium text-[#4a4a48]">
              This removes the creator and all {posts} {posts === 1 ? "post" : "posts"} saved for them, including analyses, tags and board spots. It can&apos;t be undone.
            </span>
            {error && <span className="text-[13px] font-semibold text-[#D10A6E]">{error}</span>}
            <div className="flex justify-end gap-2.5">
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="flex h-10 items-center rounded-md border border-[#E4E4E2] px-4 text-[13.5px] font-bold hover:border-[#0D0D0D]">
                Cancel
              </button>
              <button type="button" disabled={busy} onClick={go} className="flex h-10 items-center gap-1.5 rounded-md bg-[#0D0D0D] px-4 text-[13.5px] font-extrabold text-white hover:bg-[#D10A6E] disabled:opacity-70">
                {busy ? <EqualizerIcon size={15} /> : <MaterialIcon name="delete" size={17} />}
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
