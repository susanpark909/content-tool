"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Keeps a page showing the latest saved data. A phone keeps a page open in the background, so when you come back to it
// (or the browser restores it) this re-fetches it, and the page copies the new data in with useSyncedState.
export function useRefreshOnReturn(minSeconds = 90) {
  const router = useRouter();
  const last = useRef(Date.now());
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - last.current < minSeconds * 1000) return;
      last.current = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [router, minSeconds]);
}
