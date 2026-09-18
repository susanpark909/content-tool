"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  transcribeSelectedReels,
  refreshTranscriptionStatus,
} from "../../[batchId]/actions";

export function TranscribeButton({ reelId }: { reelId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await transcribeSelectedReels([reelId]);
        })
      }
    >
      {isPending ? "Starting..." : "Transcribe this reel"}
    </Button>
  );
}

export function RefreshStatusButton({ reelId }: { reelId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await refreshTranscriptionStatus(reelId);
        })
      }
    >
      {isPending ? "Checking..." : "Check status"}
    </Button>
  );
}
