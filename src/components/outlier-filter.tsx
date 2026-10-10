"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "@/components/ui/material-icon";
import { OUTLIER_GOALS, type OutlierGoal } from "@/lib/outlier";

export const OUTLIER_MINS = [0, 1.5, 2, 3, 5, 10];

// "Outlier": how many times that creator's typical reel a reel did, on views, comments or shares.
export function OutlierFilter({ metric, min, onChange, wide = false }: { metric: OutlierGoal; min: number; onChange: (metric: OutlierGoal, min: number) => void; wide?: boolean }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const label = OUTLIER_GOALS.find((g) => g.key === metric)!.label;

  function toggle() {
    if (pos) return setPos(null);
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: Math.min(r.bottom + 4, window.innerHeight - 230), left: Math.max(8, Math.min(r.left, window.innerWidth - 328)) });
  }
  const chip = "flex h-8 items-center justify-center gap-1.5 rounded-md border px-2 text-[12.5px] font-bold hover:border-[#0D0D0D]";

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        title="Outlier score: how many times that creator's typical reel"
        className={`relative flex items-center rounded-md border bg-white text-left font-semibold hover:border-[#BDBDBB] ${wide ? "h-9 w-full pr-8 pl-9 text-[13.5px] md:h-[42px]" : "h-9 w-[150px] pr-7 pl-8 text-[12.5px]"}`}
        style={{ borderColor: min > 0 ? "#FF1F8F" : "#E4E4E2" }}
      >
        <MaterialIcon name="rocket_launch" size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#4a4a48]" />
        <span className="truncate">{min > 0 ? `${label} ${min}x+` : "Outlier score"}</span>
        <MaterialIcon name="expand_more" size={18} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[#4a4a48]" />
      </button>
      {pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[80]" onClick={() => setPos(null)} />
            <div style={{ top: pos.top, left: pos.left }} className="fixed z-[81] flex w-[320px] flex-col gap-3 rounded-lg border border-[#E4E4E2] bg-white p-3 shadow-[0_12px_32px_rgba(13,13,13,0.18)]">
              <div className="flex flex-col gap-1.5">
                <span className="text-[10.5px] font-extrabold tracking-wide text-[#6b6b69] uppercase">Based on</span>
                <div className="flex gap-1.5">
                  {OUTLIER_GOALS.map((g) => (
                    <button key={g.key} type="button" onClick={() => onChange(g.key, min)} className={`${chip} flex-auto`} style={{ borderColor: metric === g.key ? "#0D0D0D" : "#E4E4E2", background: metric === g.key ? "#F0F0F1" : "#fff" }}>
                      <MaterialIcon name={g.icon} size={14} className={metric === g.key ? "text-[#FF1F8F]" : undefined} />
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10.5px] font-extrabold tracking-wide text-[#6b6b69] uppercase">At least</span>
                <div className="grid grid-cols-6 gap-1.5">
                  {OUTLIER_MINS.map((m) => (
                    <button key={m} type="button" onClick={() => onChange(metric, m)} className={chip} style={{ borderColor: min === m ? "#0D0D0D" : "#E4E4E2", background: min === m ? "#F0F0F1" : "#fff" }}>
                      {m === 0 ? "Any" : `${m}x`}
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-[11.5px] leading-snug font-medium text-[#6b6b69]">How many times that creator's typical reel it did. Needs 5 or more saved reels from the creator.</span>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

// A small score badge: "3.2x" on whichever metric the Outlier filter is set to.
export function OutlierBadge({ value, metric }: { value: number | null; metric: OutlierGoal }) {
  if (value == null) return null;
  return (
    <span
      className="flex flex-none items-center gap-0.5 rounded-md px-1.5 py-px text-[11px] font-extrabold"
      style={{ background: value >= 3 ? "#C6FF3D" : value >= 1.5 ? "#EAF8D8" : "#F0F0F1", color: "#0D0D0D" }}
      title={`${metric} outlier score: ${value.toFixed(1)}x that creator's typical reel`}
    >
      <MaterialIcon name="rocket_launch" size={12} /> {value >= 10 ? value.toFixed(0) : value.toFixed(1)}x
    </span>
  );
}
