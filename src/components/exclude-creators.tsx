"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "@/components/ui/material-icon";

// "Exclude creators": pick creators to leave out of whatever list the filter bar sits above.
export function ExcludeCreators({
  creators,
  value,
  onChange,
  labelClass = "text-[11px] font-extrabold tracking-wide text-[#6b6b69] uppercase",
  heightClass = "h-10",
  className = "",
  compact = false,
}: {
  creators: string[];
  value: string[];
  onChange: (v: string[]) => void;
  labelClass?: string;
  heightClass?: string;
  className?: string;
  compact?: boolean;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [q, setQ] = useState("");
  const btn = useRef<HTMLButtonElement>(null);
  const list = useMemo(() => {
    const query = q.trim().toLowerCase().replace(/^@/, "");
    return creators.filter((c) => !query || c.toLowerCase().includes(query));
  }, [creators, q]);

  function toggleOpen() {
    if (pos) {
      setPos(null);
      return;
    }
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.max(260, r.width);
    setQ("");
    setPos({ top: Math.min(r.bottom + 4, window.innerHeight - 340), left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width });
  }
  const toggle = (c: string) => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);

  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      {!compact && <span className={labelClass}>Exclude</span>}
      <button
        ref={btn}
        type="button"
        onClick={toggleOpen}
        className={`relative flex ${heightClass} w-full items-center rounded-md border border-[#E4E4E2] bg-white text-left font-semibold hover:border-[#BDBDBB] ${compact ? "pr-7 pl-8 text-[12.5px]" : "pr-8 pl-9 text-[13px]"}`}
        style={{ borderColor: value.length ? "#FF1F8F" : undefined }}
      >
        <MaterialIcon name="person_off" size={17} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#4a4a48]" />
        <span className="truncate">{compact ? (value.length === 0 ? "Exclude creators" : value.length === 1 ? "Excluding @" + value[0] : `Excluding ${value.length}`) : value.length === 0 ? "No one" : value.length === 1 ? "@" + value[0] : `${value.length} creators`}</span>
        <MaterialIcon name="expand_more" size={18} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[#4a4a48]" />
      </button>
      {pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[80]" onClick={() => setPos(null)} />
            <div style={{ top: pos.top, left: pos.left, width: pos.width }} className="fixed z-[81] flex max-h-[330px] flex-col overflow-hidden rounded-lg border border-[#E4E4E2] bg-white shadow-[0_12px_32px_rgba(13,13,13,0.18)]">
              <div className="flex items-center gap-2 border-b border-[#F0F0F1] px-3 py-2">
                <MaterialIcon name="search" size={17} className="text-[#4a4a48]" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Find a creator…"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-medium outline-none"
                />
                {value.length > 0 && (
                  <button type="button" onClick={() => onChange([])} className="text-[12px] font-bold text-[#D10A6E] hover:underline">
                    Clear
                  </button>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto py-1">
                {list.length === 0 && <span className="block px-3 py-4 text-center text-[13px] font-medium text-[#4a4a48]">No creators found.</span>}
                {list.map((c) => {
                  const on = value.includes(c);
                  return (
                    <button key={c} type="button" onClick={() => toggle(c)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-semibold hover:bg-[#F6F6F5]">
                      <span className="flex size-4 flex-none items-center justify-center rounded-[3px] border-[1.5px]" style={{ background: on ? "#0D0D0D" : "#FFFFFF", borderColor: on ? "#0D0D0D" : "#BDBDBB" }}>
                        {on && <MaterialIcon name="check" size={12} className="text-white" />}
                      </span>
                      <span className="truncate">@{c}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
