"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";

const COLLAPSED_LINES = 3;

// A text box that starts small and grows taller as you write. With
// `collapsible`, long text shows about 3 lines until you click into it or
// press Show More, so a page full of boxes stays compact.
export function AutoTextarea({
  value,
  onChange,
  className = "",
  wrapperClassName = "",
  onBlur,
  placeholder,
  minRows = 2,
  collapsible = false,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  wrapperClassName?: string;
  onBlur?: () => void;
  placeholder?: string;
  minRows?: number;
  collapsible?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);
  const [collapsedPx, setCollapsedPx] = useState(90);

  const wrapRef = useRef<HTMLDivElement>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // Hidden (display: none) boxes measure as 0 tall - leave them alone and
    // measure again once they're on screen.
    if (el.clientWidth === 0) return;
    // Shrinking the box to measure it makes the page shorter for an instant, which
    // makes the scrolling area above it jump. Remember where every scrolling parent
    // was and put each back afterwards, so typing never moves your view.
    const saved: { node: HTMLElement; top: number }[] = [];
    for (let n: HTMLElement | null = el.parentElement; n; n = n.parentElement) {
      if (n.scrollTop > 0) saved.push({ node: n, top: n.scrollTop });
    }
    const winY = window.scrollY;
    el.style.height = "auto";
    const h = el.scrollHeight;
    // Cut off after exactly 3 whole lines (plus the box padding) so a line is
    // never sliced in half.
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize) || 15;
    const lh = parseFloat(cs.lineHeight) || fs * 1.5;
    const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const collapsed = Math.round(pad + lh * COLLAPSED_LINES);
    setFullHeight(h);
    setCollapsedPx(collapsed);
    el.style.height = `${collapsible && !expanded && h > collapsed + 2 ? collapsed : h}px`;
    for (const { node, top } of saved) node.scrollTop = top;
    if (window.scrollY !== winY) window.scrollTo(window.scrollX, winY);
  }, [collapsible, expanded]);

  useLayoutEffect(() => {
    measure();
  }, [value, measure]);

  // Re-measure when the box first appears or its width changes.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let lastW = wrap.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth;
      if (w !== lastW) {
        lastW = w;
        measure();
      }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [measure]);

  const canCollapse = collapsible && fullHeight > collapsedPx + 2;

  return (
    <div ref={wrapRef} className={`relative min-w-0 ${wrapperClassName}`}>
      <textarea
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        ref={ref}
        value={value}
        rows={minRows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onFocus={() => {
          if (collapsible) setExpanded(true);
        }}
        className={`resize-none overflow-hidden ${canCollapse ? "pr-9" : ""} ${className}`}
      />
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
