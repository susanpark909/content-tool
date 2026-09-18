"use client";

import { useState, useTransition } from "react";
import { SendIcon, CheckIcon } from "lucide-react";
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

  return (
    <Button
      size="icon-xs"
      variant="ghost"
      disabled={isPending || queued}
      onClick={handleAdd}
      className="shrink-0 text-muted-foreground hover:text-foreground"
      title={
        error
          ? error
          : queued
            ? "Sent to Brand Profile for review"
            : "Add to Brand Profile"
      }
    >
      {queued ? (
        <CheckIcon className="text-primary" />
      ) : (
        <SendIcon className={error ? "text-destructive" : undefined} />
      )}
    </Button>
  );
}
