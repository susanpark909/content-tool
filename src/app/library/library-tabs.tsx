"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { SavedReelsClient, type SavedReelRow } from "./saved-reels-client";
import { ScriptsLibraryClient } from "./scripts-library-client";

type Tab = "hooks" | "scripts";

export function LibraryTabs({ savedReelRows }: { savedReelRows: SavedReelRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab: Tab = searchParams.get("tab") === "scripts" ? "scripts" : "hooks";
  const [tab, setTab] = useState<Tab>(initialTab);

  function switchTab(next: Tab) {
    setTab(next);
    router.replace(`/library?tab=${next}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5 border-b">
        <button
          onClick={() => switchTab("hooks")}
          className={cn(
            "border-b-2 px-3 py-2 text-sm font-medium",
            tab === "hooks"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Hooks ({savedReelRows.length})
        </button>
        <button
          onClick={() => switchTab("scripts")}
          className={cn(
            "border-b-2 px-3 py-2 text-sm font-medium",
            tab === "scripts"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Scripts ({savedReelRows.length})
        </button>
      </div>

      {tab === "hooks" && <SavedReelsClient rows={savedReelRows} />}
      {tab === "scripts" && <ScriptsLibraryClient rows={savedReelRows} />}
    </div>
  );
}
