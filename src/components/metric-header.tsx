"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "@/components/ui/material-icon";

export type MetricOption = { value: string; label: string; icon: string; tip?: string };

// A column title you can sort by, with a tiny arrow beside it that picks WHICH metric the column shows.
export function MetricHeader({
  suffix,
  options,
  value,
  onChange,
  title,
  arrow,
  onSort,
  active,
}: {
  suffix?: string;
  options: MetricOption[];
  value: string;
  onChange: (v: string) => void;
  title: string;
  arrow: string;
  onSort: () => void;
  active: boolean;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const cur = options.find((o) => o.value === value) ?? options[0];

  function toggle() {
    if (pos) return setPos(null);
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left - 70, window.innerWidth - 180)) });
  }

  return (
    <span className="flex items-center justify-center justify-self-center">
      <button
        type="button"
        onClick={onSort}
        title={cur.tip ?? `${title}: ${cur.label}`}
        aria-label={cur.tip ?? `${title}: ${cur.label}`}
        className={`flex items-center gap-0.5 whitespace-nowrap hover:text-[#FF1F8F] ${active ? "text-[#0D0D0D]" : ""}`}
      >
        <MaterialIcon name={cur.icon} size={17} />
        {suffix && <span className="-ml-0.5 text-[11px] font-extrabold">{suffix}</span>}
        <MaterialIcon name={arrow} size={15} />
      </button>
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        title={`Choose what ${title.toLowerCase()} shows`}
        aria-label={`Choose what ${title.toLowerCase()} shows`}
        className="flex size-5 items-center justify-center rounded text-[#9a9a98] hover:bg-[#F0F0F1] hover:text-[#0D0D0D]"
      >
        <MaterialIcon name="expand_more" size={16} />
      </button>
      {pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setPos(null)} />
            <div style={{ top: pos.top, left: pos.left }} className="fixed z-[101] flex w-[170px] flex-col rounded-lg border border-[#E4E4E2] bg-white py-1 shadow-[0_12px_32px_rgba(13,13,13,0.18)]">
              <span className="px-3 pt-2 pb-1 text-[10.5px] font-extrabold tracking-wide text-[#9a9a98] uppercase">{title} based on</span>
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setPos(null);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold text-[#0D0D0D] hover:bg-[#F6F6F5]"
                  style={{ background: o.value === value ? "#F0F0F1" : undefined }}
                >
                  <MaterialIcon name={o.icon} size={16} />
                  {o.label}
                  {o.value === value && <MaterialIcon name="check" size={15} className="ml-auto" />}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </span>
  );
}
