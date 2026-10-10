"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "@/components/ui/material-icon";

// One look for every dropdown: a compact pill that opens an on-brand list (not the browser's own popup).
// `prefix` is shown in grey before the value, so a row of pills doesn't need labels above them.
export function Dropdown({
  value,
  onChange,
  options,
  prefix,
  icon,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  prefix?: string;
  icon?: string;
  className?: string;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  function toggle() {
    if (pos) return setPos(null);
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.max(190, r.width);
    setPos({ top: Math.min(r.bottom + 4, window.innerHeight - 280), left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width });
  }

  return (
    <div className={className}>
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        className={`relative flex h-9 w-full cursor-pointer items-center rounded-md border border-[#E4E4E2] bg-white pr-7 text-left text-[12.5px] font-semibold text-[#0D0D0D] hover:border-[#BDBDBB] ${icon ? "pl-8" : "pl-3"}`}
        style={{ borderColor: pos ? "#0D0D0D" : undefined }}
      >
        {icon && <MaterialIcon name={icon} size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#4a4a48]" />}
        <span className="truncate">
          {prefix && <span className="mr-1 font-bold text-[#6b6b69]">{prefix}</span>}
          {current?.label}
        </span>
        <MaterialIcon name="expand_more" size={18} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[#4a4a48]" />
      </button>
      {pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[80]" onClick={() => setPos(null)} />
            <div style={{ top: pos.top, left: pos.left, width: pos.width }} className="fixed z-[81] flex max-h-[270px] flex-col overflow-y-auto rounded-lg border border-[#E4E4E2] bg-white py-1 shadow-[0_12px_32px_rgba(13,13,13,0.18)]">
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
