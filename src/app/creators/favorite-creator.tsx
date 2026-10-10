"use client";

import { useState } from "react";
import { setFavoriteCreator } from "./favorite-actions";

// A heart that favorites a creator. Updates instantly, saves in the background.
export function FavoriteCreator({ username, initial, size = 22, className = "" }: { username: string; initial: boolean; size?: number; className?: string }) {
  const [on, setOn] = useState(initial);
  return (
    <button
      type="button"
      title={on ? "Remove from favorite creators" : "Favorite this creator"}
      aria-label={on ? "Remove from favorite creators" : "Favorite this creator"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !on;
        setOn(next);
        setFavoriteCreator(username, next).catch(() => setOn(!next));
      }}
      className={`flex flex-none items-center justify-center rounded-full hover:bg-[#F0F0F1] ${className}`}
    >
      <span className="msym select-none" style={{ fontSize: size, color: on ? "#FF1F8F" : "#9a9a98", fontVariationSettings: `'FILL' ${on ? 1 : 0}, 'wght' 400` }} aria-hidden="true">
        favorite
      </span>
    </button>
  );
}
