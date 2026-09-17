"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const SORT_LABELS: Record<SortKey, string> = {
  views: "Views",
  likes: "Likes",
  commentsCount: "Comments",
  commentRate: "Comment rate",
  viewsMultiplier: "Standout (views)",
};

function formatMultiplier(value: number) {
  return `${value.toFixed(1)}x avg`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
}

export function CreatorResultsTable({ reels }: { reels: ReelRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sorted = useMemo(
    () => [...reels].sort((a, b) => b[sortKey] - a[sortKey]),
    [reels, sortKey],
  );

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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by</span>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-44">
              <SelectValue>
                {(value: SortKey) => SORT_LABELS[value]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="views">Views</SelectItem>
              <SelectItem value="likes">Likes</SelectItem>
              <SelectItem value="commentsCount">Comments</SelectItem>
              <SelectItem value="commentRate">Comment rate</SelectItem>
              <SelectItem value="viewsMultiplier">Standout (views)</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Likes</TableHead>
              <TableHead className="text-right">Comments</TableHead>
              <TableHead className="text-right">Comment rate</TableHead>
              <TableHead className="text-right">Views vs. avg</TableHead>
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
