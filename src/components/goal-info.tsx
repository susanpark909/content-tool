"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { IDEA_GOALS } from "@/lib/idea-goals";

// A small (i) button that opens a plain explanation of what each goal means. Used next to the goal everywhere it's picked.
export function GoalInfo({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="What do the goals mean?"
        aria-label="What do the goals mean?"
        className={`flex flex-none items-center justify-center rounded-full text-[#6b6b69] hover:text-[#FF1F8F] ${className}`}
      >
        <MaterialIcon name="info" size={19} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label="What each goal means" className="flex max-h-[85vh] w-full max-w-[420px] flex-col gap-3 overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[17px] font-black">What Each Goal Means</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex size-8 items-center justify-center rounded-full hover:bg-[#F0F0F1]">
                <MaterialIcon name="close" size={20} />
              </button>
            </div>
            {IDEA_GOALS.map((g) => (
              <div key={g.key} className="flex flex-col gap-1 rounded-lg bg-[#F7F7F8] p-3">
                <span className="flex items-center gap-1.5 text-[14px] font-extrabold">
                  <MaterialIcon name={g.icon} size={17} />
                  {g.label}
                </span>
                <span className="text-[13.5px] leading-[1.4] font-medium text-[#4a4a48]">{g.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
