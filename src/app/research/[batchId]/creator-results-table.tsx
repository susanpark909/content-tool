"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ReelRow = {
  id: string;
  url: string;
  caption: string | null;
  thumbnailUrl: string | null;
  postedAt: string | null;
  views: number;
  likes: number;
  commentsCount: number;
  commentRate: number;
  viewsMultiplier: number;
  commentRateMultiplier: number;
};

type SortKey = "views" | "likes" | "commentsCount" | "commentRate" | "viewsMultiplier";
type SortDirection = "asc" | "desc";

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

  const sorted = useMemo(() => {
    const arr = [...reels].sort((a, b) => a[sortKey] - b[sortKey]);
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" disabled={selected.size === 0}>
          Transcribe selected ({selected.size}) — coming soon
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Reel</TableHead>
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
                label="Comment rate"
                sortKey="commentRate"
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
                        className="h-12 w-12 rounded object-cover"
                      />
                    )}
                    <span className="max-w-64 truncate text-sm">
                      {reel.caption || "(no caption)"}
                    </span>
                  </a>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDate(reel.postedAt)}
                </TableCell>
                <TableCell className="text-right">
                  {reel.views.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {reel.likes.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {reel.commentsCount.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {(reel.commentRate * 100).toFixed(2)}%
                </TableCell>
                <TableCell className="text-right">
                  {formatMultiplier(reel.viewsMultiplier)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
