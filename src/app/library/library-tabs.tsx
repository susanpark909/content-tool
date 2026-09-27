"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { HookLibraryClient, type HookRow } from "./hook-library-client";
import {
  FrameworkLibraryClient,
  type FrameworkRow,
} from "./framework-library-client";

type Tab = "hooks" | "frameworks";

export function LibraryTabs({
  hookRows,
  hookPatterns,
  frameworkRows,
}: {
  hookRows: HookRow[];
  hookPatterns: { id: string; name: string }[];
  frameworkRows: FrameworkRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "frameworks" ? "frameworks" : "hooks";
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
          Hooks ({hookRows.length})
        </button>
        <button
          onClick={() => switchTab("frameworks")}
          className={cn(
            "border-b-2 px-3 py-2 text-sm font-medium",
            tab === "frameworks"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          Body ({frameworkRows.length})
        </button>
      </div>

      {tab === "hooks" ? (
        <HookLibraryClient rows={hookRows} hookPatterns={hookPatterns} />
      ) : (
        <FrameworkLibraryClient frameworks={frameworkRows} />
      )}
    </div>
  );
}
