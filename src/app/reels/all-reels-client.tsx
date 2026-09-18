"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
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

export type AllReelsRow = {
  id: string;
  url: string;
  caption: string | null;
  thumbnailUrl: string | null;
  ownerUsername: string | null;
  postedAt: string | null;
  views: number;
  likes: number;
  commentsCount: number;
  sharesCount: number | null;
  transcriptionStatus: string | null;
  hasHook: boolean;
  hasFrameworkExample: boolean;
};

type SortKey = "views" | "likes" | "commentsCount" | "postedAt";
type SortDirection = "asc" | "desc";
type Filter = "all" | "transcribed";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function num(value: string | number | null) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}

function TranscriptBadge({ status }: { status: string | null }) {
  if (status === "ready") return <Badge variant="secondary">Ready</Badge>;
  if (status === "processing") return <Badge variant="outline">Processing...</Badge>;
  if (status === "error") return <Badge variant="destructive">Error</Badge>;
  return <span className="text-muted-foreground">—</span>;
}

function SortableHead({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === activeKey;
  return (
    <TableHead
      className="cursor-pointer select-none text-right"
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

export function AllReelsClient({ rows }: { rows: AllReelsRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("postedAt");
  const [direction, setDirection] = useState<SortDirection>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setDirection((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setDirection("desc");
    }
  }

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === "transcribed") {
      list = list.filter((r) => r.transcriptionStatus === "ready");
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.caption, r.ownerUsername].filter(Boolean).some((f) => f!.toLowerCase().includes(q)),
      );
    }
    const sorted = [...list].sort((a, b) => num(a[sortKey]) - num(b[sortKey]));
    return direction === "desc" ? sorted.reverse() : sorted;
  }, [rows, filter, query, sortKey, direction]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search caption or creator..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              filter === "all"
                ? "border-foreground bg-foreground text-background"
                : "text-muted-foreground",
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter("transcribed")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              filter === "transcribed"
                ? "border-foreground bg-foreground text-background"
                : "text-muted-foreground",
            )}
          >
            Transcribed only
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} reel{filtered.length === 1 ? "" : "s"}
      </p>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-md border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reel</TableHead>
              <TableHead>Creator</TableHead>
              <TableHead>Transcript</TableHead>
              <TableHead>Saved</TableHead>
              <SortableHead
                label="Date"
                sortKey="postedAt"
                activeKey={sortKey}
                direction={direction}
                onSort={handleSort}
              />
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link
                    href={`/research/reel/${r.id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    {r.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.thumbnailUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded object-cover"
                      />
                    )}
                    <span className="max-w-48 truncate text-sm">
                      {r.caption || "(no caption)"}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {r.ownerUsername ? `@${r.ownerUsername}` : "—"}
                </TableCell>
                <TableCell>
                  <TranscriptBadge status={r.transcriptionStatus} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {r.hasHook && <Badge variant="outline">Hook</Badge>}{" "}
                  {r.hasFrameworkExample && <Badge variant="outline">Framework</Badge>}
                  {!r.hasHook && !r.hasFrameworkExample && (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDate(r.postedAt)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {r.views.toLocaleString()}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {r.likes.toLocaleString()}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {r.commentsCount.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {filtered.map((r) => (
          <Link
            href={`/research/reel/${r.id}`}
            key={r.id}
            className="flex flex-col gap-2 rounded-md border p-3"
          >
            <div className="flex items-start gap-3">
              {r.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.thumbnailUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded object-cover"
                />
              )}
              <div className="flex flex-1 flex-col gap-1">
                <span className="line-clamp-2 text-sm">
                  {r.caption || "(no caption)"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.ownerUsername ? `@${r.ownerUsername}` : "—"} ·{" "}
                  {formatDate(r.postedAt)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{r.views.toLocaleString()} views</span>
              <span>{r.likes.toLocaleString()} likes</span>
              <span>{r.commentsCount.toLocaleString()} comments</span>
              <TranscriptBadge status={r.transcriptionStatus} />
              {r.hasHook && <Badge variant="outline">Hook</Badge>}
              {r.hasFrameworkExample && <Badge variant="outline">Framework</Badge>}
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No reels match your search/filter.
        </p>
      )}
    </div>
  );
}
