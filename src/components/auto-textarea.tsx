"use client";

import { useLayoutEffect, useRef, useState } from "react";

const COLLAPSED_PX = 90;

// A text box that starts small and grows taller as you write. With
// `collapsible`, long text shows about 3 lines until you click into it or
// press Show More, so a page full of boxes stays compact.
export function AutoTextarea({
  value,
  onChange,
  className = "",
  placeholder,
  minRows = 2,
  collapsible = false,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  minRows?: number;
  collapsible?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const h = el.scrollHeight;
    setFullHeight(h);
    el.style.height = `${collapsible && !expanded && h > COLLAPSED_PX ? COLLAPSED_PX : h}px`;
  }, [value, expanded, collapsible]);

  const canCollapse = collapsible && fullHeight > COLLAPSED_PX;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <textarea
        ref={ref}
        value={value}
        rows={minRows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (collapsible) setExpanded(true);
        }}
        className={`resize-none overflow-hidden ${className}`}
      />
      {canCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="self-start text-xs font-bold text-[#4a4a48] hover:text-[#FF1F8F]"
        >
          {expanded ? "Show Less" : "Show More"}
        </button>
      )}
    </div>
  );
}
