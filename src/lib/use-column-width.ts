"use client";

import { useEffect, useRef, useState } from "react";

// Drag-to-resize for a single table column, persisted per table via
// localStorage so the width sticks across visits.
export function useColumnWidth(storageKey: string, initial: number, min = 160, max = 720) {
  const [width, setWidth] = useState(initial);
  const widthRef = useRef(initial);
  widthRef.current = width;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setWidth(Math.min(max, Math.max(min, Number(saved))));
    } catch {
      // ignore - private browsing / blocked storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widthRef.current;
    function onMove(ev: MouseEvent) {
      setWidth(Math.min(max, Math.max(min, startWidth + (ev.clientX - startX))));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      try {
        localStorage.setItem(storageKey, String(widthRef.current));
      } catch {
        // ignore
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return { width, startDrag };
}
