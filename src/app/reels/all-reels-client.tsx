"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon, ChevronUpIcon, CircleCheckIcon, PencilIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { deleteReels, updateReelStats, repullReels, setReelGoal, setReelGoalBulk, type ReelGoal } from "./actions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
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
  createdAt: string;
  views: number;
  likes: number;
  commentsCount: number;
  commentRate: number | null;
  sharesCount: number | null;
  shareRate: number | null;
  durationSeconds: number | null;
  transcriptionStatus: string | null;
  hasHook: boolean;
  hasFrameworkExample: boolean;
  goal: ReelGoal | null;
};

const GOAL_LABELS: Record<ReelGoal, string> = {
  views: "Views",
  shares: "Shares",
  comments: "Comments",
};

type SortKey =
  | "views"
  | "likes"
  | "commentsCount"
  | "sharesCount"
  | "durationSeconds"
  | "postedAt"
  | "createdAt"
  | "ownerUsername";
type SortDirection = "asc" | "desc";
type Filter = "all" | "transcribed";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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

function StatusCheck({ done, title }: { done: boolean; title?: string }) {
  return done ? (
    <CircleCheckIcon className="size-4 text-primary" aria-label={title} />
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

function TranscribedCheck({ status }: { status: string | null }) {
  if (status === "ready") return <StatusCheck done title="Transcribed" />;
  if (status === "processing") return <Badge variant="outline">Processing...</Badge>;
  if (status === "error") return <Badge variant="destructive">Error</Badge>;
  return <span className="text-muted-foreground">—</span>;
}

function GoalSelect({
  value,
  onChange,
}: {
  value: ReelGoal | null;
  onChange: (goal: ReelGoal | null) => void;
}) {
  return (
    <Select
      value={value ?? "none"}
      onValueChange={(v) => onChange(v === "none" ? null : (v as ReelGoal))}
    >
      <SelectTrigger className="h-7 w-28 text-xs" size="sm">
        <SelectValue>{(v: string) => (v === "none" ? "—" : GOAL_LABELS[v as ReelGoal])}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">—</SelectItem>
        <SelectItem value="views">Views</SelectItem>
        <SelectItem value="shares">Shares</SelectItem>
        <SelectItem value="comments">Comments</SelectItem>
      </SelectContent>
    </Select>
  );
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [editMode, setEditMode] = useState(false);

  function toggleEditMode() {
    setEditMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: string[]) {
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(ids);
    });
  }

  function confirmDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setDeleteDialogOpen(false);
    setSelectedIds(new Set());
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
    startDeleteTransition(async () => {
      try {
        await deleteReels(ids);
      } catch {
        router.refresh();
      }
    });
  }

  const [repullDialogOpen, setRepullDialogOpen] = useState(false);
  const [isRepulling, startRepullTransition] = useTransition();
  const [repullResult, setRepullResult] = useState<{ updated: number; failed: number } | null>(
    null,
  );

  function confirmRepull() {
    const ids = [...selectedIds];
    const urls = rows.filter((r) => ids.includes(r.id)).map((r) => r.url);
    if (urls.length === 0) return;
    setRepullResult(null);
    startRepullTransition(async () => {
      try {
        const result = await repullReels(urls);
        setRepullResult({ updated: result.updated, failed: result.failed.length });
        setSelectedIds(new Set());
        router.refresh();
      } catch {
        setRepullDialogOpen(false);
        router.refresh();
      }
    });
  }

  function updateRowField(id: string, field: "views" | "likes" | "commentsCount" | "sharesCount", value: number | null) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function handleGoalChange(id: string, goal: ReelGoal | null) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, goal } : r)));
    setReelGoal(id, goal).catch(() => router.refresh());
  }

  const [isSettingGoal, startGoalTransition] = useTransition();

  function handleBulkGoal(goal: ReelGoal | null) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, goal } : r)));
    startGoalTransition(async () => {
      try {
        await setReelGoalBulk(ids, goal);
      } catch {
        router.refresh();
      }
    });
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
          {editMode && (
            <>
              <Select
                value="_placeholder"
                onValueChange={(v) =>
                  handleBulkGoal(v === "none" ? null : (v as ReelGoal))
                }
              >
                <SelectTrigger
                  className="w-auto"
                  size="sm"
                  disabled={selectedIds.size === 0 || isSettingGoal}
                >
                  <SelectValue>
                    {() => `Set goal (${selectedIds.size})`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Clear goal</SelectItem>
                  <SelectItem value="views">Views</SelectItem>
                  <SelectItem value="shares">Shares</SelectItem>
                  <SelectItem value="comments">Comments</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                disabled={selectedIds.size === 0 || isDeleting || isRepulling}
                onClick={() => {
                  setRepullResult(null);
                  setRepullDialogOpen(true);
                }}
              >
                <RefreshCwIcon /> Re-pull selected ({selectedIds.size})
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={selectedIds.size === 0 || isDeleting}
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2Icon /> Delete selected ({selectedIds.size})
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant={editMode ? "default" : "outline"}
            onClick={toggleEditMode}
          >
            <PencilIcon /> {editMode ? "Done" : "Edit"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} reel{filtered.length === 1 ? "" : "s"}
      </p>

      {/* Desktop table */}
      <div className="hidden max-h-[75vh] overflow-auto rounded-md border sm:block">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0] shadow-border">
            <TableRow>
              {editMode && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id))
                    }
                    onCheckedChange={() => toggleSelectAll(filtered.map((r) => r.id))}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
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
              <TableHead>Transcribed</TableHead>
              <TableHead>Hook</TableHead>
              <TableHead>Body</TableHead>
              <TableHead>Goal</TableHead>
              <SortableHead
                label="Created"
                sortKey="postedAt"
                activeKey={sortKey}
                direction={direction}
                onSort={handleSort}
              />
              <SortableHead
                label="Analyzed"
                sortKey="createdAt"
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
              <SortableHead
                label="Length"
                sortKey="durationSeconds"
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
                    <Checkbox
                      checked={selectedIds.has(r.id)}
                      onCheckedChange={() => toggleSelected(r.id)}
                      aria-label="Select reel"
                    />
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <Link
                      href={`/research/reel/${r.id}`}
                      className="line-clamp-2 max-w-48 text-sm hover:underline"
                    >
                      {r.caption || "(no caption)"}
                    </Link>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-fit text-xs text-muted-foreground hover:underline"
                    >
                      View Reel
                    </a>
                  </div>
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
                  <TranscribedCheck status={r.transcriptionStatus} />
                </TableCell>
                <TableCell>
                  <StatusCheck done={r.hasHook} title="Hook saved" />
                </TableCell>
                <TableCell>
                  <StatusCheck done={r.hasFrameworkExample} title="Body saved" />
                </TableCell>
                <TableCell>
                  <GoalSelect
                    value={r.goal}
                    onChange={(goal) => handleGoalChange(r.id, goal)}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDate(r.postedAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDate(r.createdAt)}
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
                <TableCell className="text-right whitespace-nowrap text-sm">
                  {formatDuration(r.durationSeconds)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {filtered.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex items-start gap-3">
              {editMode && (
                <Checkbox
                  checked={selectedIds.has(r.id)}
                  onCheckedChange={() => toggleSelected(r.id)}
                  aria-label="Select reel"
                  className="mt-1"
                />
              )}
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/research/reel/${r.id}`}
                    className="line-clamp-2 text-sm hover:underline"
                  >
                    {r.caption || "(no caption)"}
                  </Link>
                </div>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-fit text-xs text-muted-foreground hover:underline"
                >
                  View Reel
                </a>
                <span className="text-xs text-muted-foreground">
                  {r.ownerUsername ? (
                    <button
                      onClick={() => updateCreatorFilter(r.ownerUsername!)}
                      className="hover:underline"
                    >
                      @{r.ownerUsername}
                    </button>
                  ) : (
                    "—"
                  )}{" "}
                  · {formatDate(r.postedAt)} · analyzed {formatDate(r.createdAt)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{formatDuration(r.durationSeconds)}</span>
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
              <TranscribedCheck status={r.transcriptionStatus} />
              {r.hasHook && <Badge variant="outline">Hook</Badge>}
              {r.hasFrameworkExample && <Badge variant="outline">Body</Badge>}
            </div>
            <GoalSelect value={r.goal} onChange={(goal) => handleGoalChange(r.id, goal)} />
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No reels match your search/filter.
        </p>
      )}

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete ${selectedIds.size} reel${selectedIds.size === 1 ? "" : "s"}?`}
        description={`This also removes any hooks or body examples saved from ${selectedIds.size === 1 ? "it" : "them"}. This can't be undone.`}
        onConfirm={confirmDelete}
        isPending={isDeleting}
      />

      <Dialog
        open={repullDialogOpen}
        onOpenChange={(open) => {
          setRepullDialogOpen(open);
          if (!open) setRepullResult(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {repullResult
                ? "Re-pull complete"
                : `Re-pull ${selectedIds.size} reel${selectedIds.size === 1 ? "" : "s"}?`}
            </DialogTitle>
            <DialogDescription>
              {repullResult ? (
                <>
                  Updated {repullResult.updated} reel
                  {repullResult.updated === 1 ? "" : "s"} with fresh stats and
                  length.
                  {repullResult.failed > 0 &&
                    ` ${repullResult.failed} failed to update.`}{" "}
                  Check the Analyzed date column to see which ones just
                  refreshed.
                </>
              ) : (
                <>
                  Pulls fresh views, likes, comments, shares, and length for
                  each selected reel from Apify and updates it in place.
                  Transcripts and saved hooks/body examples are left alone.
                  Estimated cost: ~${(selectedIds.size * 0.007).toFixed(2)}{" "}
                  worst case.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {repullResult ? (
              <Button onClick={() => setRepullDialogOpen(false)}>Done</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={isRepulling}
                  onClick={() => setRepullDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button disabled={isRepulling} onClick={confirmRepull}>
                  {isRepulling ? "Re-pulling..." : "Re-pull"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
