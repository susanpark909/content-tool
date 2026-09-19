"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PlanCard } from "./plan-card";
import { createIdeaOnDate, moveIdeaToDate } from "./actions";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type PlanEntry = {
  id: string;
  content: string;
  hookName: string | null;
  readyToRecord: boolean;
  recorded: boolean;
  posted: boolean;
};

export function PlanCalendar({
  cells,
  entriesByDate,
  todayIso,
}: {
  cells: { date: string | null; day: number | null }[];
  entriesByDate: Record<string, PlanEntry[]>;
  todayIso: string;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(entriesByDate);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [addDialogDate, setAddDialogDate] = useState<string | null>(null);
  const [addText, setAddText] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleDrop(date: string) {
    setDragOverDate(null);
    const id = draggingId;
    setDraggingId(null);
    if (!id) return;

    setEntries((prev) => {
      let moved: PlanEntry | undefined;
      const next: Record<string, PlanEntry[]> = {};
      for (const [d, list] of Object.entries(prev)) {
        const filtered = list.filter((e) => {
          if (e.id === id) {
            moved = e;
            return false;
          }
          return true;
        });
        next[d] = filtered;
      }
      if (moved) {
        next[date] = [...(next[date] ?? []), moved];
      }
      return next;
    });

    startTransition(async () => {
      try {
        await moveIdeaToDate(id, date);
        router.refresh();
      } catch {
        router.refresh();
      }
    });
  }

  function handleAddSave() {
    if (!addDialogDate || !addText.trim()) return;
    const date = addDialogDate;
    startTransition(async () => {
      try {
        await createIdeaOnDate(addText, date);
        setAddText("");
        setAddDialogDate(null);
        router.refresh();
      } catch {
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border text-xs">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-muted px-2 py-1.5 text-center font-medium text-muted-foreground">
            {label}
          </div>
        ))}
        {cells.map((cell, i) => (
          <div
            key={i}
            onDragOver={(e) => {
              if (!cell.date) return;
              e.preventDefault();
              setDragOverDate(cell.date);
            }}
            onDragLeave={() => setDragOverDate((d) => (d === cell.date ? null : d))}
            onDrop={(e) => {
              if (!cell.date) return;
              e.preventDefault();
              handleDrop(cell.date);
            }}
            className={cn(
              "flex min-h-36 flex-col gap-1 bg-background p-1.5",
              cell.date === todayIso && "bg-primary/5",
              cell.date && dragOverDate === cell.date && "bg-primary/10 ring-1 ring-inset ring-primary/40",
            )}
          >
            {cell.day && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{cell.day}</span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="size-4 text-muted-foreground hover:text-foreground"
                    title="Add a post"
                    onClick={() => {
                      setAddText("");
                      setAddDialogDate(cell.date);
                    }}
                  >
                    <PlusIcon className="size-3" />
                  </Button>
                </div>
                <div className="flex flex-col gap-1">
                  {(entries[cell.date!] ?? []).map((entry) => (
                    <PlanCard
                      key={entry.id}
                      ideaId={entry.id}
                      content={entry.content}
                      hookName={entry.hookName}
                      readyToRecord={entry.readyToRecord}
                      recorded={entry.recorded}
                      posted={entry.posted}
                      dragging={draggingId === entry.id}
                      onDragStart={() => setDraggingId(entry.id)}
                      onDragEnd={() => setDraggingId(null)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <Dialog open={addDialogDate != null} onOpenChange={(open) => !open && setAddDialogDate(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Add a post
              {addDialogDate &&
                ` — ${new Date(`${addDialogDate}T00:00:00`).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}`}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            placeholder="What's the idea?"
            rows={3}
            autoFocus
          />
          <DialogFooter>
            <Button onClick={handleAddSave} disabled={!addText.trim() || isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
