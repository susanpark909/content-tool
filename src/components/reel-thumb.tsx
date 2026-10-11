"use client";

import { useEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";

// Small video-thumbnail chip used in reel tables. Instagram's own CDN
// thumbnail links expire after about a week (reels pulled before the
// permanent-thumbnail re-hosting was added still have those raw links
// saved) - falls back to a plain dark tile with a play icon instead of a
// broken-image glyph when the url 404s or never loads.
// A picture that fails once (bad signal, busy moment) is tried again a couple of times before the plain tile takes over.
function useRetryingImage(url: string | null) {
  const [broken, setBroken] = useState(false);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    setBroken(false);
    setTries(0);
  }, [url]);
  const src = url ? (tries > 0 ? url + (url.includes("?") ? "&" : "?") + "r=" + tries : url) : null;
  const onError = () => {
    if (tries < 2) setTimeout(() => setTries((n) => n + 1), 1200 * (tries + 1));
    else setBroken(true);
  };
  return { src, broken, onError };
}

export function ReelThumb({ url, className }: { url: string | null; className?: string }) {
  const { src, broken, onError } = useRetryingImage(url);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = imgRef.current;
    // a picture that already failed before the page woke up never fires onError, so check here too
    if (el && el.complete && el.naturalWidth === 0) onError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  return (
    <span className={`relative flex h-10 w-[30px] flex-none items-center justify-center overflow-hidden rounded-[3px] bg-[#2b2b29] ${className ?? ""}`}>
      {src && !broken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          ref={imgRef}
          src={src}
          alt=""
          decoding="async"
          onError={onError}
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
  const { src, broken, onError } = useRetryingImage(url);
  return (
    <>
      {src && !broken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" decoding="async" onError={onError} className="absolute inset-0 size-full object-cover" />
      )}
      {showPlay && (
        <span className="relative flex size-full items-center justify-center">
          <MaterialIcon name="play_arrow" size={iconSize} weight={500} className="text-white opacity-85" />
        </span>
      )}
    </>
  );
}
