"use client";

import { useState, useTransition } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dismissBatchWarning } from "./actions";

export function DismissibleWarning({
  batchId,
  field,
  children,
  className = "text-sm",
}: {
  batchId: string;
  field: "incomplete" | "window";
  children: React.ReactNode;
  className?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (dismissed) return null;

  return (
    <p className={`flex items-start gap-1.5 text-destructive ${className}`}>
      <span className="flex-1">{children}</span>
      <Button
        size="icon-xs"
        variant="ghost"
        disabled={isPending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDismissed(true);
          startTransition(async () => {
            await dismissBatchWarning(batchId, field);
          });
        }}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        title="Dismiss"
      >
        <XIcon />
      </Button>
    </p>
  );
}
