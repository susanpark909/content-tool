"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { queueBrandProfileNote } from "@/app/brand/actions";

export function AddToBrand({
  entryId,
  content,
}: {
  entryId: string;
  content: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!content.trim()) return null;

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      try {
        await queueBrandProfileNote(content, entryId);
        setQueued(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  if (queued) {
    return (
      <span className="text-xs text-muted-foreground">
        Sent to{" "}
        <Link href="/brand" className="underline">
          Brand Profile
        </Link>{" "}
        for review.
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="xs" variant="outline" disabled={isPending} onClick={handleAdd}>
        {isPending ? "Sending..." : "Add to Brand Profile"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
