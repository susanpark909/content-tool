"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDownIcon, ChevronUpIcon, Trash2Icon } from "lucide-react";
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
import { transcribeSelectedReels, refreshTranscriptionStatus } from "./actions";
import { deleteReels } from "../../reels/actions";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";

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
  | "viewsMultiplier"
  | "postedAt";
type SortDirection = "asc" | "desc";

function num(value: number | string | null | undefined) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return new Date(value).getTime();
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
  batchId,
  initialSortKey = "views",
}: {
  reels: ReelRow[];
  batchId: string;
  initialSortKey?: SortKey;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sortKey, setSortKey] = useState<SortKey>(
    (searchParams.get("sort") as SortKey | null) ?? initialSortKey,
  );
  const [direction, setDirection] = useState<SortDirection>(
    searchParams.get("dir") === "asc" ? "asc" : "desc",
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const arr = [...reels].sort((a, b) => num(a[sortKey]) - num(b[sortKey]));
    return direction === "desc" ? arr.reverse() : arr;
  }, [reels, sortKey, direction]);

  // Transcription has no webhook back to us - the only way a "Processing..."
  // badge ever updates is by re-checking the transcription API. Poll any
  // still-processing reels in the background so the table doesn't just sit
  // stuck forever until someone manually opens each reel and clicks
  // "Check status". Re-runs whenever fresh `reels` props land (after a
  // revalidated check), naturally stopping once nothing is processing.
  useEffect(() => {
    const processingIds = reels
      .filter((r) => r.transcriptionStatus === "processing")
      .map((r) => r.id);
    if (processingIds.length === 0) return;

    const timer = setTimeout(() => {
      Promise.all(processingIds.map((id) => refreshTranscriptionStatus(id).catch(() => {})));
    }, 8000);

    return () => clearTimeout(timer);
  }, [reels]);

  function updateUrl(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) params.set(key, value);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      const nextDir = direction === "desc" ? "asc" : "desc";
      setDirection(nextDir);
      updateUrl({ dir: nextDir });
    } else {
      setSortKey(key);
      setDirection("desc");
      updateUrl({ sort: key, dir: "desc" });
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

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  function confirmDeleteSelected() {
    const ids = [...selected];
    setError(null);
    startTransition(async () => {
      try {
        await deleteReels(ids, batchId);
        setSelected(new Set());
        setDeleteDialogOpen(false);
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
          className="text-destructive hover:text-destructive"
          disabled={selected.size === 0 || isPending}
          onClick={() => setDeleteDialogOpen(true)}
        >
          <Trash2Icon /> Delete selected ({selected.size})
        </Button>
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
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <Link
                        href={`/research/reel/${reel.id}`}
                        className="line-clamp-2 max-w-40 text-sm hover:underline lg:max-w-56"
                      >
                        {reel.caption || "(no caption)"}
                      </Link>
                      <a
                        href={reel.url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-fit text-xs text-muted-foreground hover:underline"
                      >
                        View Reel
                      </a>
                    </div>
                  </div>
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
              <Link
                href={`/research/reel/${reel.id}`}
                className="flex flex-1 items-center gap-2"
              >
                <span className="line-clamp-2 text-sm">
                  {reel.caption || "(no caption)"}
                </span>
              </Link>
            </div>
            <a
              href={reel.url}
              target="_blank"
              rel="noreferrer"
              className="w-fit text-xs text-muted-foreground hover:underline"
            >
              View Reel
            </a>

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

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete ${selected.size} reel${selected.size === 1 ? "" : "s"}?`}
        description={`This also removes any hooks or framework examples saved from ${selected.size === 1 ? "it" : "them"}. This can't be undone.`}
        onConfirm={confirmDeleteSelected}
        isPending={isPending}
      />
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
