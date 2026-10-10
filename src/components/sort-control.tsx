"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "@/components/ui/material-icon";

export type SortOption = { value: string; label: string };

// "Sort: Views" plus one small arrow button that flips high-to-low, so there's no second list of "least ..." options.
export function SortControl({
  options,
  value,
  onChange,
  asc,
  onToggleAsc,
  dateKeys = ["date", "postedAt", "analyzedAt"],
}: {
  options: SortOption[];
  value: string;
  onChange: (v: string) => void;
  asc: boolean;
  onToggleAsc: () => void;
  dateKeys?: string[];
}) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value);
  const isDate = dateKeys.includes(value);
  const tip = asc ? (isDate ? "Oldest first. Click for newest first." : "Lowest first. Click for highest first.") : isDate ? "Newest first. Click for oldest first." : "Highest first. Click for lowest first.";

  function toggle() {
    if (pos) return setPos(null);
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.max(200, r.width);
    setPos({ top: Math.min(r.bottom + 4, window.innerHeight - 300), left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width });
  }

  return (
    <div className="flex gap-1">
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        className="relative flex h-9 min-w-[170px] cursor-pointer items-center rounded-md border border-[#E4E4E2] bg-white pr-7 pl-8 text-left text-[12.5px] font-semibold text-[#0D0D0D] hover:border-[#BDBDBB]"
        style={{ borderColor: pos ? "#0D0D0D" : undefined }}
      >
        <MaterialIcon name="swap_vert" size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#4a4a48]" />
        <span className="truncate">
          <span className="mr-1 font-bold text-[#6b6b69]">Sort</span>
          {current?.label ?? "Custom"}
        </span>
        <MaterialIcon name="expand_more" size={18} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[#4a4a48]" />
      </button>
      <button
        type="button"
        onClick={onToggleAsc}
        title={tip}
        aria-label={tip}
        className="flex size-9 flex-none items-center justify-center rounded-md border bg-white hover:border-[#0D0D0D]"
        style={{ borderColor: asc ? "#FF1F8F" : "#E4E4E2", color: asc ? "#FF1F8F" : "#0D0D0D" }}
      >
        <MaterialIcon name={asc ? "arrow_upward" : "arrow_downward"} size={18} />
      </button>
      {pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[80]" onClick={() => setPos(null)} />
            <div style={{ top: pos.top, left: pos.left, width: pos.width }} className="fixed z-[81] flex max-h-[290px] flex-col overflow-y-auto rounded-lg border border-[#E4E4E2] bg-white py-1 shadow-[0_12px_32px_rgba(13,13,13,0.18)]">
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setPos(null);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold hover:bg-[#F6F6F5]"
                  style={{ background: o.value === value ? "#F0F0F1" : undefined }}
                >
                  <span className="flex size-4 flex-none items-center justify-center">{o.value === value && <MaterialIcon name="check" size={15} />}</span>
                  <span className="truncate">{o.label}</span>
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
