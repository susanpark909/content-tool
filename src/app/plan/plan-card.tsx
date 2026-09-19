"use client";

import Link from "next/link";
import { CircleIcon, VideoIcon, CircleCheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PlanCard({
  ideaId,
  content,
  hookName,
  readyToRecord,
  recorded,
  posted,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  ideaId: string;
  content: string;
  hookName: string | null;
  readyToRecord: boolean;
  recorded: boolean;
  posted: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  dragging?: boolean;
}) {
  return (
    <Link
      href={`/plan/${ideaId}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", ideaId);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "flex cursor-grab flex-col gap-0.5 rounded border bg-card px-1.5 py-1 text-[11px] hover:bg-muted active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <span className="line-clamp-2 leading-tight font-medium">
        {content || "(no text)"}
      </span>
      {hookName && (
        <span className="truncate text-muted-foreground">{hookName}</span>
      )}
      <div className="mt-0.5 flex items-center gap-1 text-muted-foreground">
        <CircleIcon
          className={cn("size-2.5", readyToRecord && "fill-primary text-primary")}
        />
        <VideoIcon className={cn("size-2.5", recorded && "text-primary")} />
        <CircleCheckIcon className={cn("size-2.5", posted && "text-primary")} />
      </div>
    </Link>
  );
}
