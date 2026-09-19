"use client";

import { useState, useTransition } from "react";
import { CircleIcon, VideoIcon, CircleCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setReadyToRecord, setRecorded, setIdeaPosted } from "@/app/journal/actions";

export function StatusToggles({
  ideaId,
  readyToRecord: initialReady,
  recorded: initialRecorded,
  posted: initialPosted,
}: {
  ideaId: string;
  readyToRecord: boolean;
  recorded: boolean;
  posted: boolean;
}) {
  const [readyToRecord, setReadyToRecordState] = useState(initialReady);
  const [recorded, setRecordedState] = useState(initialRecorded);
  const [posted, setPostedState] = useState(initialPosted);
  const [isPending, startTransition] = useTransition();

  function toggleReady() {
    const next = !readyToRecord;
    startTransition(async () => {
      await setReadyToRecord(ideaId, next);
      setReadyToRecordState(next);
    });
  }

  function toggleRecorded() {
    const next = !recorded;
    startTransition(async () => {
      await setRecorded(ideaId, next);
      setRecordedState(next);
    });
  }

  function togglePosted() {
    const next = !posted;
    startTransition(async () => {
      await setIdeaPosted(ideaId, next);
      setPostedState(next);
    });
  }

  return (
    <div className="flex items-center gap-4">
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={toggleReady}
        className={cn(readyToRecord && "border-primary/50 bg-primary/5")}
      >
        <CircleIcon className={cn(readyToRecord && "fill-primary text-primary")} />
        Ready to record
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={toggleRecorded}
        className={cn(recorded && "border-primary/50 bg-primary/5")}
      >
        <VideoIcon className={cn(recorded && "text-primary")} />
        Recorded
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={togglePosted}
        className={cn(posted && "border-primary/50 bg-primary/5")}
      >
        <CircleCheckIcon className={cn(posted && "fill-primary text-primary-foreground")} />
        Posted
      </Button>
    </div>
  );
}
