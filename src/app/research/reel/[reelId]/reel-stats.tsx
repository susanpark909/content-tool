"use client";

import { useState, useTransition } from "react";
import { PencilIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateReelStats } from "@/app/reels/actions";

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ReelStats({
  reelId,
  batchId,
  views: initialViews,
  likes: initialLikes,
  commentsCount: initialComments,
  sharesCount: initialShares,
  durationSeconds,
}: {
  reelId: string;
  batchId: string | null;
  views: number;
  likes: number;
  commentsCount: number;
  sharesCount: number | null;
  durationSeconds: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [views, setViews] = useState(initialViews);
  const [likes, setLikes] = useState(initialLikes);
  const [commentsCount, setCommentsCount] = useState(initialComments);
  const [sharesCount, setSharesCount] = useState(initialShares);

  const [draftViews, setDraftViews] = useState(String(initialViews));
  const [draftLikes, setDraftLikes] = useState(String(initialLikes));
  const [draftComments, setDraftComments] = useState(String(initialComments));
  const [draftShares, setDraftShares] = useState(
    initialShares != null ? String(initialShares) : "",
  );

  const commentRate = views > 0 ? commentsCount / views : 0;
  const shareRate = views > 0 && sharesCount != null ? sharesCount / views : null;

  function startEditing() {
    setDraftViews(String(views));
    setDraftLikes(String(likes));
    setDraftComments(String(commentsCount));
    setDraftShares(sharesCount != null ? String(sharesCount) : "");
    setEditing(true);
  }

  function save() {
    const nextViews = Math.max(0, Number(draftViews) || 0);
    const nextLikes = Math.max(0, Number(draftLikes) || 0);
    const nextComments = Math.max(0, Number(draftComments) || 0);
    const nextShares = draftShares.trim() === "" ? null : Math.max(0, Number(draftShares) || 0);

    startSaving(async () => {
      await updateReelStats(
        reelId,
        { views: nextViews, likes: nextLikes, commentsCount: nextComments, sharesCount: nextShares },
        batchId ?? undefined,
      );
      setViews(nextViews);
      setLikes(nextLikes);
      setCommentsCount(nextComments);
      setSharesCount(nextShares);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Length</p>
              <p className="mt-1.5 text-sm font-medium">{formatDuration(durationSeconds)}</p>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="views" className="text-xs text-muted-foreground">
                Views
              </Label>
              <Input
                id="views"
                type="number"
                min={0}
                value={draftViews}
                onChange={(e) => setDraftViews(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="likes" className="text-xs text-muted-foreground">
                Likes
              </Label>
              <Input
                id="likes"
                type="number"
                min={0}
                value={draftLikes}
                onChange={(e) => setDraftLikes(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="comments" className="text-xs text-muted-foreground">
                Comments
              </Label>
              <Input
                id="comments"
                type="number"
                min={0}
                value={draftComments}
                onChange={(e) => setDraftComments(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="shares" className="text-xs text-muted-foreground">
                Shares
              </Label>
              <Input
                id="shares"
                type="number"
                min={0}
                placeholder="—"
                value={draftShares}
                onChange={(e) => setDraftShares(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={save} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <p className="text-xs text-muted-foreground">Length</p>
              <p className="text-lg font-medium">{formatDuration(durationSeconds)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Views</p>
              <p className="text-lg font-medium">{views.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Likes</p>
              <p className="text-lg font-medium">{likes.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Comments</p>
              <p className="text-lg font-medium">
                {commentsCount.toLocaleString()} ({(commentRate * 100).toFixed(2)}%)
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Shares</p>
              <p className="text-lg font-medium">
                {sharesCount != null
                  ? `${sharesCount.toLocaleString()} (${((shareRate ?? 0) * 100).toFixed(2)}%)`
                  : "—"}
              </p>
            </div>
          </div>
          <Button
            size="icon-xs"
            variant="ghost"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            title="Edit stats"
            onClick={startEditing}
          >
            <PencilIcon />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
