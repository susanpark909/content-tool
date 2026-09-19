"use client";

import { useState, useTransition } from "react";
import { XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { scheduleIdea } from "@/app/journal/actions";

export function ScheduleInline({
  ideaId,
  initialDate,
}: {
  ideaId: string;
  initialDate: string | null;
}) {
  const [date, setDate] = useState(initialDate ?? "");
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    setDate(value);
    startTransition(async () => {
      await scheduleIdea(ideaId, value || null);
    });
  }

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Input
        type="date"
        value={date}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isPending}
        className="h-7 w-36 text-xs"
      />
      {date && (
        <Button
          size="icon-xs"
          variant="ghost"
          className="text-muted-foreground"
          title="Unschedule"
          disabled={isPending}
          onClick={() => handleChange("")}
        >
          <XIcon className="size-3" />
        </Button>
      )}
    </div>
  );
}
