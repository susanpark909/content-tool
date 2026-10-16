"use client";

import { useState } from "react";
import { ManageTypes } from "@/components/types-ui";
import type { ContentType } from "@/lib/content-types";

// Settings home for the content tags: shows the same tag manager used everywhere else.
export function TagsTab() {
  const [types, setTypes] = useState<ContentType[]>([]);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="h-[22px] w-1 rounded-[2px] bg-[#FF1F8F]" />
        <span className="text-xl font-black tracking-[-0.025em] md:text-2xl">Content Types</span>
      </div>
      <p className="max-w-[78ch] text-[13.5px] font-medium text-[#4a4a48]">
        The kinds of content you sort reels and scripts by. Rename them, change their colors, add new ones or remove old ones.
      </p>
      <ManageTypes inline types={types} onTypesChange={setTypes} onClose={() => {}} />
    </div>
  );
}
