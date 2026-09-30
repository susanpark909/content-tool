"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";

// Small video-thumbnail chip used in reel tables. Instagram's own CDN
// thumbnail links expire after about a week (reels pulled before the
// permanent-thumbnail re-hosting was added still have those raw links
// saved) - falls back to a plain dark tile with a play icon instead of a
// broken-image glyph when the url 404s or never loads.
export function ReelThumb({ url }: { url: string | null }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="relative flex h-10 w-[30px] flex-none items-center justify-center overflow-hidden rounded-[3px] bg-[#2b2b29]">
      {url && !broken && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
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
