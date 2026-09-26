"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon, ChevronUpIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteReels, updateReelStats } from "./actions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  commentRate: number | null;
  sharesCount: number | null;
  shareRate: number | null;
  transcriptionStatus: string | null;
  hasHook: boolean;
  hasFrameworkExample: boolean;
};

type SortKey =
  | "views"
  | "likes"
  | "commentsCount"
  | "sharesCount"
  | "postedAt"
  | "ownerUsername";
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

function compare(a: AllReelsRow, b: AllReelsRow, key: SortKey) {
  if (key === "ownerUsername") {
    return (a.ownerUsername ?? "").localeCompare(b.ownerUsername ?? "");
  }
  return num(a[key]) - num(b[key]);
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

export function AllReelsClient({ rows: initialRows }: { rows: AllReelsRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState(initialRows);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [editMode, setEditMode] = useState(false);

  function confirmDelete() {
    const id = deleteTargetId;
    if (!id) return;
    setDeleteTargetId(null);
    setRows((prev) => prev.filter((r) => r.id !== id));
    startDeleteTransition(async () => {
      try {
        await deleteReels([id]);
      } catch {
        router.refresh();
      }
    });
  }

  function updateRowField(id: string, field: "views" | "likes" | "commentsCount" | "sharesCount", value: number | null) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function saveRowStats(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    updateReelStats(id, {
      views: row.views,
      likes: row.likes,
      commentsCount: row.commentsCount,
      sharesCount: row.sharesCount,
    }).catch(() => router.refresh());
  }

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [filter, setFilter] = useState<Filter>(
    searchParams.get("filter") === "transcribed" ? "transcribed" : "all",
  );
  const [creatorFilter, setCreatorFilter] = useState<string>(
    searchParams.get("creator") ?? "all",
  );
  const [sortKey, setSortKey] = useState<SortKey>(
    (searchParams.get("sort") as SortKey | null) ?? "postedAt",
  );
  const [direction, setDirection] = useState<SortDirection>(
    searchParams.get("dir") === "asc" ? "asc" : "desc",
  );

  function updateUrl(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value || value === "all" || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    router.replace(qs ? `/reels?${qs}` : "/reels", { scroll: false });
  }

  function updateQuery(value: string) {
    setQuery(value);
    updateUrl({ q: value });
  }

  function updateFilter(value: Filter) {
    setFilter(value);
    updateUrl({ filter: value });
  }

  function updateCreatorFilter(value: string) {
    setCreatorFilter(value);
    updateUrl({ creator: value });
  }

  const creators = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.ownerUsername).filter((u): u is string => Boolean(u))),
      ).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      const nextDir = direction === "desc" ? "asc" : "desc";
      setDirection(nextDir);
      updateUrl({ dir: nextDir });
    } else {
      const nextDir = key === "ownerUsername" ? "asc" : "desc";
      setSortKey(key);
      setDirection(nextDir);
      updateUrl({ sort: key, dir: nextDir });
    }
  }

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === "transcribed") {
      list = list.filter((r) => r.transcriptionStatus === "ready");
    }
    if (creatorFilter !== "all") {
      list = list.filter((r) => r.ownerUsername === creatorFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.caption, r.ownerUsername].filter(Boolean).some((f) => f!.toLowerCase().includes(q)),
      );
    }
    const sorted = [...list].sort((a, b) => compare(a, b, sortKey));
    return direction === "desc" ? sorted.reverse() : sorted;
  }, [rows, filter, creatorFilter, query, sortKey, direction]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Search caption or creator..."
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            className="max-w-sm"
          />
          <Select value={creatorFilter} onValueChange={(v) => updateCreatorFilter(v ?? "all")}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue>
                {(value: string) => (value === "all" ? "All creators" : `@${value}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All creators</SelectItem>
              {creators.map((c) => (
                <SelectItem key={c} value={c}>
                  @{c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => updateFilter("all")}
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
            onClick={() => updateFilter("transcribed")}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              filter === "transcribed"
                ? "border-foreground bg-foreground text-background"
                : "text-muted-foreground",
            )}
          >
            Transcribed only
          </button>
          <Button
            size="sm"
            variant={editMode ? "default" : "outline"}
            onClick={() => setEditMode((v) => !v)}
          >
            <PencilIcon /> {editMode ? "Done" : "Edit"}
          </Button>
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
              {editMode && <TableHead className="w-10" />}
              <TableHead>Reel</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("ownerUsername")}
              >
                <span className="inline-flex items-center gap-1">
                  Creator
                  {sortKey === "ownerUsername" &&
                    (direction === "desc" ? (
                      <ChevronDownIcon className="size-3.5" />
                    ) : (
                      <ChevronUpIcon className="size-3.5" />
                    ))}
                </span>
              </TableHead>
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
              <SortableHead
                label="Shares"
                sortKey="sharesCount"
                activeKey={sortKey}
                direction={direction}
                onSort={handleSort}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                {editMode && (
                  <TableCell>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      title="Delete reel"
                      onClick={() => setDeleteTargetId(r.id)}
                    >
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                )}
                <TableCell>
                  <Link
                    href={`/research/reel/${r.id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <span className="line-clamp-2 max-w-48 text-sm">
                      {r.caption || "(no caption)"}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {r.ownerUsername ? (
                    <button
                      onClick={() => updateCreatorFilter(r.ownerUsername!)}
                      className="hover:underline"
                    >
                      @{r.ownerUsername}
                    </button>
                  ) : (
                    "—"
                  )}
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
                {editMode ? (
                  <>
                    <TableCell className="text-right whitespace-nowrap">
                      <Input
                        type="number"
                        min={0}
                        value={r.views}
                        onChange={(e) => updateRowField(r.id, "views", Math.max(0, Number(e.target.value) || 0))}
                        onBlur={() => saveRowStats(r.id)}
                        className="h-7 w-24 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Input
                        type="number"
                        min={0}
                        value={r.likes}
                        onChange={(e) => updateRowField(r.id, "likes", Math.max(0, Number(e.target.value) || 0))}
                        onBlur={() => saveRowStats(r.id)}
                        className="h-7 w-24 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Input
                        type="number"
                        min={0}
                        value={r.commentsCount}
                        onChange={(e) => updateRowField(r.id, "commentsCount", Math.max(0, Number(e.target.value) || 0))}
                        onBlur={() => saveRowStats(r.id)}
                        className="h-7 w-24 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Input
                        type="number"
                        min={0}
                        placeholder="—"
                        value={r.sharesCount ?? ""}
                        onChange={(e) =>
                          updateRowField(
                            r.id,
                            "sharesCount",
                            e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0),
                          )
                        }
                        onBlur={() => saveRowStats(r.id)}
                        className="h-7 w-24 text-right"
                      />
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="text-right whitespace-nowrap">
                      {r.views.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {r.likes.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {r.commentsCount.toLocaleString()}
                      {r.views > 0 && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({((r.commentsCount / r.views) * 100).toFixed(2)}%)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {r.sharesCount != null ? (
                        <>
                          {r.sharesCount.toLocaleString()}
                          {r.views > 0 && (
                            <span className="text-muted-foreground">
                              {" "}
                              ({((r.sharesCount / r.views) * 100).toFixed(2)}%)
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </>
                )}
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
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 text-sm">
                    {r.caption || "(no caption)"}
                  </span>
                  {editMode && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      title="Delete reel"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteTargetId(r.id);
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {r.ownerUsername ? (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        updateCreatorFilter(r.ownerUsername!);
                      }}
                      className="hover:underline"
                    >
                      @{r.ownerUsername}
                    </button>
                  ) : (
                    "—"
                  )}{" "}
                  · {formatDate(r.postedAt)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{r.views.toLocaleString()} views</span>
              <span>{r.likes.toLocaleString()} likes</span>
              <span>
                {r.commentsCount.toLocaleString()} comments
                {r.commentRate != null && ` (${(r.commentRate * 100).toFixed(2)}%)`}
              </span>
              {r.sharesCount != null && (
                <span>
                  {r.sharesCount.toLocaleString()} shares
                  {r.shareRate != null && ` (${(r.shareRate * 100).toFixed(2)}%)`}
                </span>
              )}
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

      <ConfirmDeleteDialog
        open={deleteTargetId != null}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Delete this reel?"
        description="This also removes any hooks or framework examples saved from it. This can't be undone."
        onConfirm={confirmDelete}
        isPending={isDeleting}
      />
    </div>
  );
}
