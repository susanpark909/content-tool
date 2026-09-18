"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { scheduleIdea, setIdeaPosted } from "./actions";

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
}

export function IdeaStatus({
  entryId,
  scheduledDate,
  posted,
  onScheduledChange,
  onPostedChange,
}: {
  entryId: string;
  scheduledDate: string | null;
  posted: boolean;
  onScheduledChange?: (date: string | null) => void;
  onPostedChange?: (posted: boolean) => void;
}) {
  const [date, setDate] = useState(scheduledDate);
  const [isPosted, setPosted] = useState(posted);
  const [editingDate, setEditingDate] = useState(false);
  const [draftDate, setDraftDate] = useState(scheduledDate ?? "");
  const [isPending, startTransition] = useTransition();

  function saveDate() {
    startTransition(async () => {
      await scheduleIdea(entryId, draftDate || null);
      setDate(draftDate || null);
      onScheduledChange?.(draftDate || null);
      setEditingDate(false);
    });
  }

  function clearDate() {
    startTransition(async () => {
      await scheduleIdea(entryId, null);
      setDate(null);
      onScheduledChange?.(null);
      setDraftDate("");
    });
  }

  function togglePosted(next: boolean) {
    startTransition(async () => {
      await setIdeaPosted(entryId, next);
      setPosted(next);
      onPostedChange?.(next);
    });
  }

  if (editingDate) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={draftDate}
          onChange={(e) => setDraftDate(e.target.value)}
          className="h-7 w-auto text-xs"
        />
        <Button size="xs" disabled={isPending} onClick={saveDate}>
          Save
        </Button>
        <Button size="xs" variant="ghost" onClick={() => setEditingDate(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isPosted ? (
        <>
          <Badge variant="secondary">Posted</Badge>
          <button
            disabled={isPending}
            onClick={() => togglePosted(false)}
            className="text-xs text-muted-foreground hover:underline"
          >
            Unmark
          </button>
        </>
      ) : (
        <>
          {date ? (
            <>
              <Badge variant="outline">Scheduled: {formatDate(date)}</Badge>
              <button
                disabled={isPending}
                onClick={() => {
                  setDraftDate(date);
                  setEditingDate(true);
                }}
                className="text-xs text-muted-foreground hover:underline"
              >
                Change date
              </button>
              <button
                disabled={isPending}
                onClick={clearDate}
                className="text-xs text-muted-foreground hover:underline"
              >
                Unschedule
              </button>
            </>
          ) : (
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setDraftDate("");
                setEditingDate(true);
              }}
            >
              Schedule
            </Button>
          )}
          <Button
            size="xs"
            variant="outline"
            disabled={isPending}
            onClick={() => togglePosted(true)}
          >
            Mark as posted
          </Button>
        </>
      )}
    </div>
  );
}
