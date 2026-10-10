"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "@/components/ui/material-icon";

// One "Filters" button that opens a small panel holding every filter, so the page stays uncluttered.
// The count badge shows how many filters are on; Clear turns them all off.
export function FilterPanel({ count, onClear, children, heightClass = "h-10" }: { count: number; onClear: () => void; children: React.ReactNode; heightClass?: string }) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);

  function toggle() {
    if (pos) return setPos(null);
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(480, window.innerWidth - 16);
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width });
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        className={`flex ${heightClass} flex-none items-center gap-1.5 rounded-md border bg-white px-3.5 text-[13px] font-bold hover:border-[#0D0D0D]`}
        style={{ borderColor: pos || count > 0 ? "#0D0D0D" : "#E4E4E2" }}
      >
        <MaterialIcon name="tune" size={18} /> Filters
        {count > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-[#FF1F8F] text-[11px] font-extrabold text-[#0D0D0D]">{count}</span>}
      </button>
      {pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setPos(null)} />
            <div style={{ top: pos.top, left: pos.left, width: pos.width }} className="fixed z-[71] flex max-h-[calc(100vh-120px)] flex-col gap-3 overflow-y-auto rounded-xl border border-[#E4E4E2] bg-white p-4 shadow-[0_16px_48px_rgba(13,13,13,0.2)]">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-extrabold">Filters</span>
                <div className="flex items-center gap-3">
                  {count > 0 && (
                    <button type="button" onClick={onClear} className="text-[12.5px] font-bold text-[#FF1F8F] hover:text-[#0D0D0D]">
                      Clear all
                    </button>
                  )}
                  <button type="button" onClick={() => setPos(null)} aria-label="Close" className="flex size-7 items-center justify-center rounded-md hover:bg-[#F0F0F1]">
                    <MaterialIcon name="close" size={18} />
                  </button>
                </div>
              </div>
              {children}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
