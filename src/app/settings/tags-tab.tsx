"use client";

import { useEffect, useState } from "react";
import { ManageTypes } from "@/components/types-ui";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { ContentType } from "@/lib/content-types";

// Settings home for the content tags: opens the same tag manager used everywhere else.
export function TagsTab() {
  const [open, setOpenState] = useState(false);
  // remembered, so the tag manager is still open if the page redraws itself after a save
  useEffect(() => {
    try {
      if (sessionStorage.getItem("vh-tags-open") === "1") setOpenState(true);
    } catch {}
  }, []);
  const setOpen = (v: boolean) => {
    setOpenState(v);
    try {
      sessionStorage.setItem("vh-tags-open", v ? "1" : "0");
    } catch {}
  };
  const [types, setTypes] = useState<ContentType[]>([]);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="h-[22px] w-1 rounded-[2px] bg-[#FF1F8F]" />
        <span className="text-xl font-black tracking-[-0.025em] md:text-2xl">Content Types</span>
      </div>
      <p className="max-w-[78ch] text-[13.5px] font-medium text-[#4a4a48]">
        The kinds of content you sort reels and scripts by. Rename them, change their colors, add new ones or remove old ones.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 flex h-10 items-center gap-2 self-start rounded-md bg-[#FF1F8F] px-4 text-[13.5px] font-bold text-white hover:opacity-90"
      >
        <MaterialIcon name="tune" size={17} /> Manage Types
      </button>
      {open && <ManageTypes types={types} onTypesChange={setTypes} onClose={() => setOpen(false)} />}
    </div>
  );
}
