"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateBrandProfileFromText } from "@/app/brand/actions";

export function AddToBrand({ content }: { content: string }) {
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!content.trim()) return null;

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      try {
        await updateBrandProfileFromText(content);
        setAdded(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="xs" variant="outline" disabled={isPending} onClick={handleAdd}>
        {isPending ? "Adding..." : "Add to Brand Profile"}
      </Button>
      {added && !isPending && (
        <span className="text-xs text-muted-foreground">Added.</span>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
