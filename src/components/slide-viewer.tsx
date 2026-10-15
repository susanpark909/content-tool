"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";

export type ViewerSlide = { url: string; text?: string };

// A carousel's slides in a strip: tap one to open it big, then swipe (or use the arrows or the keyboard) to move through them.
export function SlideStrip({ slides }: { slides: ViewerSlide[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {slides.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Open slide ${i + 1} of ${slides.length}`}
            className="flex w-[220px] flex-none cursor-zoom-in flex-col overflow-hidden rounded-xl border border-[#F0F0F1] bg-white text-left shadow-[0_4px_16px_rgba(13,13,13,0.08)] hover:border-[#FF1F8F]"
          >
            <div className="relative aspect-[4/5] bg-[#2b2b29]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
              <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white">
                {i + 1} / {slides.length}
              </span>
            </div>
            {s.text ? (
              <div className="flex flex-col gap-1 p-3">
                <span className="text-[10.5px] font-extrabold tracking-wide text-[#FF1F8F] uppercase">Slide {i + 1}</span>
                <span className="text-[13px] leading-snug font-medium whitespace-pre-wrap text-[#0D0D0D]">{s.text}</span>
              </div>
            ) : (
              <div className="p-3">
                <span className="text-[10.5px] font-extrabold tracking-wide text-[#FF1F8F] uppercase">Slide {i + 1}</span>
              </div>
            )}
          </button>
        ))}
      </div>
      {open != null && <SlideViewer slides={slides} start={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function SlideViewer({ slides, start, onClose }: { slides: ViewerSlide[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const [drag, setDrag] = useState(0);
  const touch = useRef<{ x: number; y: number; moving: boolean } | null>(null);
  const last = slides.length - 1;

  const go = useCallback((n: number) => setIndex((i) => Math.max(0, Math.min(last, i + n))), [last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  const nav = "absolute top-1/2 z-10 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 max-md:hidden";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Carousel slides"
      className="fixed inset-0 z-[100] flex flex-col bg-black/92"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="text-[15px] font-bold">
          {index + 1} / {slides.length}
        </span>
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/30">
          <MaterialIcon name="close" size={26} weight={500} />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 touch-pan-y items-center overflow-hidden"
        onTouchStart={(e) => {
          const t = e.touches[0];
          touch.current = { x: t.clientX, y: t.clientY, moving: false };
        }}
        onTouchMove={(e) => {
          if (!touch.current) return;
          const t = e.touches[0];
          const dx = t.clientX - touch.current.x;
          const dy = t.clientY - touch.current.y;
          if (!touch.current.moving && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) touch.current.moving = true;
          if (touch.current.moving) setDrag(dx);
        }}
        onTouchEnd={() => {
          if (touch.current?.moving) {
            if (drag < -60) go(1);
            else if (drag > 60) go(-1);
          }
          touch.current = null;
          setDrag(0);
        }}
      >
        <div
          className="flex size-full"
          style={{ transform: `translateX(calc(${-index * 100}% + ${drag}px))`, transition: drag === 0 ? "transform 220ms ease" : "none" }}
        >
          {slides.map((s, i) => (
            <div key={i} className="flex size-full flex-none items-center justify-center px-2 md:px-16" onClick={(e) => e.stopPropagation()}>
              {Math.abs(i - index) <= 1 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.url} alt={`Slide ${i + 1}`} draggable={false} className="max-h-full max-w-full rounded-lg object-contain select-none" />
              )}
            </div>
          ))}
        </div>
        {index > 0 && (
          <button type="button" aria-label="Previous slide" onClick={(e) => { e.stopPropagation(); go(-1); }} className={`${nav} left-4`}>
            <MaterialIcon name="chevron_left" size={30} weight={500} />
          </button>
        )}
        {index < last && (
          <button type="button" aria-label="Next slide" onClick={(e) => { e.stopPropagation(); go(1); }} className={`${nav} right-4`}>
            <MaterialIcon name="chevron_right" size={30} weight={500} />
          </button>
        )}
      </div>

      {slides[index]?.text ? (
        <div className="max-h-[22vh] overflow-y-auto px-5 py-3 text-[15px] leading-snug font-medium whitespace-pre-wrap text-white/90" onClick={(e) => e.stopPropagation()}>
          {slides[index].text}
        </div>
      ) : (
        <div className="h-4" />
      )}
    </div>
  );
}
