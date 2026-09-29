"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, SendIcon, Trash2Icon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { removeFromQueue, retryQueueItem, sendToLibrary } from "./actions";

export type QueueRow = {
  id: string;
  url: string;
  status: "pending" | "ready" | "error";
  caption: string | null;
  ownerUsername: string | null;
  postedAt: string | null;
  views: number | null;
  likes: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  durationSeconds: number | null;
  errorMessage: string | null;
  createdAt: string;
};

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function StatusBadge({ status }: { status: QueueRow["status"] }) {
  if (status === "ready") return <Badge variant="secondary">Ready</Badge>;
  if (status === "error") return <Badge variant="destructive">Error</Badge>;
  return (
    <Badge variant="outline" className="gap-1">
      <Loader2Icon className="size-3 animate-spin" /> Pending
    </Badge>
  );
}

function QueueRowActions({
  row,
  onRemoved,
}: {
  row: QueueRow;
  onRemoved: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRemove() {
    setError(null);
    onRemoved(row.id);
    startTransition(async () => {
      try {
        await removeFromQueue(row.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove");
      }
    });
  }

  function handleSend() {
    setError(null);
    startTransition(async () => {
      try {
        await sendToLibrary(row.id);
        onRemoved(row.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to send");
      }
    });
  }

  function handleRetry() {
    setError(null);
    startTransition(async () => {
      try {
        await retryQueueItem(row.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Retry failed");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {row.status === "error" && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={handleRetry}>
            <RefreshCwIcon /> Retry
          </Button>
        )}
        {row.status === "ready" && (
          <Button size="sm" disabled={isPending} onClick={handleSend}>
            <SendIcon /> Send to library
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          title="Remove from queue"
          disabled={isPending}
          onClick={handleRemove}
        >
          <Trash2Icon />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function QueueClient({ rows: initialRows }: { rows: QueueRow[] }) {
  const [rows, setRows] = useState(initialRows);

  function handleRemoved(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {rows.length} queued reel{rows.length === 1 ? "" : "s"}
      </p>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-md border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reel</TableHead>
              <TableHead>Creator</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Posted</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Likes</TableHead>
              <TableHead className="text-right">Comments</TableHead>
              <TableHead className="text-right">Shares</TableHead>
              <TableHead className="text-right">Length</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="line-clamp-2 max-w-48 text-sm">
                      {r.caption || "(no caption yet)"}
                    </span>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-fit text-xs text-muted-foreground hover:underline"
                    >
                      View Reel
                    </a>
                    {r.status === "error" && r.errorMessage && (
                      <span className="text-xs text-destructive">{r.errorMessage}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {r.ownerUsername ? `@${r.ownerUsername}` : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDate(r.postedAt)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {r.views != null ? r.views.toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {r.likes != null ? r.likes.toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {r.commentsCount != null ? r.commentsCount.toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {r.sharesCount != null ? r.sharesCount.toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {formatDuration(r.durationSeconds)}
                </TableCell>
                <TableCell>
                  <QueueRowActions row={r} onRemoved={handleRemoved} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="line-clamp-2 text-sm">{r.caption || "(no caption yet)"}</span>
              <StatusBadge status={r.status} />
            </div>
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="w-fit text-xs text-muted-foreground hover:underline"
            >
              View Reel
            </a>
            {r.status === "error" && r.errorMessage && (
              <p className="text-xs text-destructive">{r.errorMessage}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {r.ownerUsername && <span>@{r.ownerUsername}</span>}
              <span>{formatDate(r.postedAt)}</span>
              {r.views != null && <span>{r.views.toLocaleString()} views</span>}
              {r.likes != null && <span>{r.likes.toLocaleString()} likes</span>}
              {r.commentsCount != null && (
                <span>{r.commentsCount.toLocaleString()} comments</span>
              )}
              {r.sharesCount != null && <span>{r.sharesCount.toLocaleString()} shares</span>}
              <span>{formatDuration(r.durationSeconds)}</span>
            </div>
            <QueueRowActions row={r} onRemoved={handleRemoved} />
          </div>
        ))}
      </div>
    </div>
  );
}
