"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";

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
    <div className="relative min-w-0">
      <textarea
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        ref={ref}
        value={value}
        rows={minRows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (collapsible) setExpanded(true);
        }}
        className={`resize-none overflow-hidden ${canCollapse ? "pr-9" : ""} ${className}`}
      />
      {canCollapse && !expanded && (
        <span className="pointer-events-none absolute right-px bottom-px left-px h-7 rounded-b-md bg-gradient-to-t from-white to-transparent" />
      )}
      {canCollapse && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? "Collapse" : "Expand"}
          title={expanded ? "Collapse" : "Expand"}
          className="absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded text-[#4a4a48] hover:bg-[#F0F0F1] hover:text-[#0D0D0D]"
        >
          <MaterialIcon name={expanded ? "expand_less" : "expand_more"} size={20} />
        </button>
      )}
    </div>
  );
}
