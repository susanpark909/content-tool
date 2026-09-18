"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { transcribeSelectedReels } from "./actions";

export type ReelRow = {
  id: string;
  url: string;
  caption: string | null;
  thumbnailUrl: string | null;
  postedAt: string | null;
  views: number;
  likes: number;
  commentsCount: number;
  sharesCount: number | null;
  commentRate: number;
  shareRate: number | null;
  viewsMultiplier: number;
  commentRateMultiplier: number;
  transcriptionStatus: string | null;
};

type SortKey =
  | "views"
  | "likes"
  | "commentsCount"
  | "sharesCount"
  | "commentRate"
  | "shareRate"
  | "viewsMultiplier";
type SortDirection = "asc" | "desc";

function num(value: number | null | undefined) {
  return value ?? 0;
}

function formatMultiplier(value: number) {
  return `${value.toFixed(1)}x avg`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
}

function SortableHead({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === activeKey;
  return (
    <TableHead
      className={cn("cursor-pointer select-none text-right", className)}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        {active &&
          (direction === "desc" ? (
            <ChevronDownIcon className="size-3.5" />
          ) : (
            <ChevronUpIcon className="size-3.5" />
          ))}
      </span>
    </TableHead>
  );
}

export function CreatorResultsTable({
  reels,
  initialSortKey = "views",
}: {
  reels: ReelRow[];
  initialSortKey?: SortKey;
}) {
  const [sortKey, setSortKey] = useState<SortKey>(initialSortKey);
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const arr = [...reels].sort((a, b) => num(a[sortKey]) - num(b[sortKey]));
    return direction === "desc" ? arr.reverse() : arr;
  }, [reels, sortKey, direction]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setDirection("desc");
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleTranscribeSelected() {
    setError(null);
    startTransition(async () => {
      try {
        await transcribeSelectedReels([...selected]);
        setSelected(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          size="sm"
          variant="outline"
          disabled={selected.size === 0 || isPending}
          onClick={handleTranscribeSelected}
        >
          {isPending
            ? "Starting transcription..."
            : `Transcribe selected (${selected.size})`}
        </Button>
      </div>

      {/* Desktop / tablet: table */}
      <div className="hidden overflow-x-auto rounded-md border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Reel</TableHead>
              <TableHead>Transcript</TableHead>
              <TableHead>Date</TableHead>
              <SortableHead
                label="Views"
                sortKey="views"
                activeKey={sortKey}
                direction={direction}
                onSort={handleSort}
              />
              <SortableHead
                label="Likes"
                sortKey="likes"
                activeKey={sortKey}
                direction={direction}
                onSort={handleSort}
              />
              <SortableHead
                label="Comments"
                sortKey="commentsCount"
                activeKey={sortKey}
                direction={direction}
                onSort={handleSort}
              />
              <SortableHead
                label="Shares"
                sortKey="sharesCount"
                activeKey={sortKey}
                direction={direction}
                onSort={handleSort}
              />
              <SortableHead
                label="Views vs. avg"
                sortKey="viewsMultiplier"
                activeKey={sortKey}
                direction={direction}
                onSort={handleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((reel) => (
              <TableRow key={reel.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(reel.id)}
                    onCheckedChange={() => toggle(reel.id)}
                  />
                </TableCell>
                <TableCell>
                  <a
                    href={reel.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 hover:underline"
                  >
                    {reel.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={reel.thumbnailUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded object-cover"
                      />
                    )}
                    <span className="max-w-40 truncate text-sm lg:max-w-56">
                      {reel.caption || "(no caption)"}
                    </span>
                  </a>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  <TranscriptBadge reelId={reel.id} status={reel.transcriptionStatus} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDate(reel.postedAt)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {reel.views.toLocaleString()}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {reel.likes.toLocaleString()}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {reel.commentsCount.toLocaleString()}
                  <span className="text-muted-foreground">
                    {" "}
                    ({(reel.commentRate * 100).toFixed(2)}%)
                  </span>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {reel.sharesCount != null ? (
                    <>
                      {reel.sharesCount.toLocaleString()}
                      {reel.shareRate != null && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({(reel.shareRate * 100).toFixed(2)}%)
                        </span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {formatMultiplier(reel.viewsMultiplier)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {sorted.map((reel) => (
          <div key={reel.id} className="flex flex-col gap-3 rounded-md border p-3">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selected.has(reel.id)}
                onCheckedChange={() => toggle(reel.id)}
                className="mt-1"
              />
              <a
                href={reel.url}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center gap-2"
              >
                {reel.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={reel.thumbnailUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded object-cover"
                  />
                )}
                <span className="line-clamp-2 text-sm">
                  {reel.caption || "(no caption)"}
                </span>
              </a>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatDate(reel.postedAt)}</span>
              <TranscriptBadge reelId={reel.id} status={reel.transcriptionStatus} />
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Views</p>
                <p>
                  {reel.views.toLocaleString()}{" "}
                  <span className="text-muted-foreground">
                    ({formatMultiplier(reel.viewsMultiplier)})
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Likes</p>
                <p>{reel.likes.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Comments</p>
                <p>
                  {reel.commentsCount.toLocaleString()}{" "}
                  <span className="text-muted-foreground">
                    ({(reel.commentRate * 100).toFixed(2)}%)
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Shares</p>
                <p>
                  {reel.sharesCount != null ? (
                    <>
                      {reel.sharesCount.toLocaleString()}{" "}
                      {reel.shareRate != null && (
                        <span className="text-muted-foreground">
                          ({(reel.shareRate * 100).toFixed(2)}%)
                        </span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TranscriptBadge({
  reelId,
  status,
}: {
  reelId: string;
  status: string | null;
}) {
  if (status === "ready") {
    return (
      <Link href={`/research/reel/${reelId}`} className="hover:underline">
        <Badge variant="secondary">View transcript</Badge>
      </Link>
    );
  }
  if (status === "processing") {
    return (
      <Link href={`/research/reel/${reelId}`} className="hover:underline">
        <Badge variant="outline">Processing...</Badge>
      </Link>
    );
  }
  if (status === "error") {
    return (
      <Link href={`/research/reel/${reelId}`} className="hover:underline">
        <Badge variant="destructive">Error</Badge>
      </Link>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}
