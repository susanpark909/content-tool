"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

function labelFor(path: string | null) {
  if (!path) return null;
  if (path === "/idea") return "Back to Ideas";
  if (path === "/calendar") return "Back to Calendar";
  if (path === "/library") return "Back to Library";
  if (path === "/reels") return "Back to All Reels";
  if (path.startsWith("/boards/")) return "Back to Board";
  if (path === "/analyze-reel") return "Back to Analyze Reel";
  if (path === "/") return "Back to Goals";
  return null;
}

// Always goes back to the exact page you came from (and says which one).
export function BackLink({
  fallbackHref,
  label = "Back",
}: {
  fallbackHref: string;
  label?: string;
}) {
  const router = useRouter();
  const [shown, setShown] = useState("Back");
  void label;

  useEffect(() => {
    try {
      const l = labelFor(sessionStorage.getItem("vh-prev-path"));
      setShown(l ?? "Back");
    } catch {
      setShown("Back");
    }
  }, []);

  return (
    <button
      onClick={() => {
        // Where we came from, if we know it; otherwise the page's default.
        let target = fallbackHref;
        try {
          const prev = sessionStorage.getItem("vh-prev-path");
          if (prev && labelFor(prev)) target = prev;
        } catch {}
        const before = window.location.href;
        if (window.history.length > 1) router.back();
        // In the Home Screen app, going back can silently do nothing. If the page
        // hasn't changed a moment later, go there directly.
        setTimeout(
          () => {
            if (window.location.href === before) router.push(target);
          },
          window.history.length > 1 ? 450 : 0,
        );
      }}
      className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
    >
      <ChevronLeftIcon className="size-4" />
      {shown}
    </button>
  );
}
