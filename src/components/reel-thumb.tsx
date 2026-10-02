"use client";

import { useEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";

// Small video-thumbnail chip used in reel tables. Instagram's own CDN
// thumbnail links expire after about a week (reels pulled before the
// permanent-thumbnail re-hosting was added still have those raw links
// saved) - falls back to a plain dark tile with a play icon instead of a
// broken-image glyph when the url 404s or never loads.
export function ReelThumb({ url }: { url: string | null }) {
  const [broken, setBroken] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, [url]);
  return (
    <span className="relative flex h-10 w-[30px] flex-none items-center justify-center overflow-hidden rounded-[3px] bg-[#2b2b29]">
      {url && !broken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={url}
          alt=""
          onError={() => setBroken(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <MaterialIcon name="play_arrow" size={14} weight={500} className="relative text-white" />
    </span>
  );
}

// Fills its (relative, overflow-hidden) parent - used for the larger New cards
// and board tiles. Same broken-link fallback as ReelThumb.
export function ReelCover({ url, iconSize = 32, showPlay = true }: { url: string | null; iconSize?: number; showPlay?: boolean }) {
  const [broken, setBroken] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth === 0) setBroken(true);
  }, [url]);
  return (
    <>
      {url && !broken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={imgRef} src={url} alt="" onError={() => setBroken(true)} className="absolute inset-0 size-full object-cover" />
      )}
      {showPlay && (
        <span className="relative flex size-full items-center justify-center">
          <MaterialIcon name="play_arrow" size={iconSize} weight={500} className="text-white opacity-85" />
        </span>
      )}
    </>
  );
}
