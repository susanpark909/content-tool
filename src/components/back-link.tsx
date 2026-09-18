"use client";

import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

export function BackLink({
  fallbackHref,
  label = "Back",
}: {
  fallbackHref: string;
  label?: string;
}) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
    >
      <ChevronLeftIcon className="size-4" />
      {label}
    </button>
  );
}
