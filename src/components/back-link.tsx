"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

function labelFor(path: string | null) {
  if (!path) return null;
  if (path === "/idea") return "Back to Ideas";
  if (path === "/calendar") return "Back to Calendar";
  if (path === "/scripts") return "Back to Scripts";
  if (path === "/library") return "Back to Hook Vault";
  if (path === "/creators" || path.startsWith("/creators/")) return "Back to Creators";
  if (path === "/reels") return "Back to Library";
  if (path === "/boards") return "Back to Boards";
  if (path.startsWith("/boards/")) return "Back to Board";
  if (path === "/analyze-reel") return "Back to Analyze";
  if (path.startsWith("/analyze-reel/reel/")) return "Back to Reel";
  if (path.startsWith("/scripts/")) return "Back to Script";
  if (path === "/") return "Back to Goals";
  return null;
}

// The page right before this one in your own history (kept by the site nav).
function previousPath(): string | null {
  try {
    const stack: string[] = JSON.parse(sessionStorage.getItem("vh-stack") ?? "[]");
    const cur = window.location.pathname;
    const top = stack[stack.length - 1];
    return (top === cur ? stack[stack.length - 2] : top) ?? null;
  } catch {
    return null;
  }
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
    // wait a tick so the site nav has recorded this page first
    const t = setTimeout(() => setShown(labelFor(previousPath()) ?? "Back"), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <button
      onClick={() => {
        // Where we came from, if we know it; otherwise the page's default.
        let target = fallbackHref;
        const prev = previousPath();
        if (prev && labelFor(prev)) target = prev;
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
