"use client";

import { useEffect, useRef, useState } from "react";

// Replaces the browser's own hover text (the `title` attribute) with one on-brand tooltip that is always
// kept fully on screen: it flips above/below and slides sideways so no edge ever cuts it off.
export function GlobalTooltips() {
  const [tip, setTip] = useState<{ text: string; rect: DOMRect } | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const target = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function restore() {
      const el = target.current;
      if (el && el.dataset.tipText != null) {
        el.setAttribute("title", el.dataset.tipText);
        delete el.dataset.tipText;
      }
      target.current = null;
    }
    function hide() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      restore();
      setTip(null);
      setPos(null);
    }
    function over(e: MouseEvent) {
      const el = (e.target as HTMLElement | null)?.closest?.("[title]") as HTMLElement | null;
      if (!el || el === target.current) return;
      const text = el.getAttribute("title")?.trim();
      if (!text) return;
      hide();
      // hold the text ourselves so the browser's own tooltip never shows
      el.dataset.tipText = text;
      el.removeAttribute("title");
      target.current = el;
      timer.current = setTimeout(() => setTip({ text, rect: el.getBoundingClientRect() }), 350);
    }
    function out(e: MouseEvent) {
      const el = target.current;
      if (el && !el.contains(e.relatedTarget as Node | null)) hide();
    }
    document.addEventListener("mouseover", over, true);
    document.addEventListener("mouseout", out, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("mousedown", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("mouseover", over, true);
      document.removeEventListener("mouseout", out, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("mousedown", hide, true);
      window.removeEventListener("blur", hide);
      hide();
    };
  }, []);

  // place it once it has been measured
  useEffect(() => {
    if (!tip || !box.current) return;
    const b = box.current.getBoundingClientRect();
    const m = 8;
    let left = tip.rect.left + tip.rect.width / 2 - b.width / 2;
    left = Math.max(m, Math.min(left, window.innerWidth - b.width - m));
    let top = tip.rect.bottom + 8;
    if (top + b.height > window.innerHeight - m) top = Math.max(m, tip.rect.top - b.height - 8);
    setPos({ top, left });
  }, [tip]);

  if (!tip) return null;
  return (
    <div
      ref={box}
      role="tooltip"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? "visible" : "hidden" }}
      className="pointer-events-none fixed z-[200] max-w-[min(320px,calc(100vw-16px))] rounded-lg bg-[#0D0D0D] px-3 py-2 text-[12.5px] leading-snug font-semibold text-white shadow-[0_8px_24px_rgba(13,13,13,0.28)]"
    >
      {tip.text}
    </div>
  );
}
