"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export type HookRow = {
  id: string;
  hookText: string;
  patternName: string | null;
  emotionalMechanism: string | null;
  ctaUsed: string | null;
  whyItWorked: string | null;
  reelId: string | null;
  reelUrl: string | null;
  ownerUsername: string | null;
  thumbnailUrl: string | null;
  views: number | null;
  likes: number | null;
  commentsCount: number | null;
};

export function HookLibraryClient({ rows }: { rows: HookRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.hookText, r.patternName, r.emotionalMechanism, r.ctaUsed, r.ownerUsername]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Search hooks, patterns, emotions, creators..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      <div className="flex flex-col gap-3">
        {filtered.map((row) => (
          <Card key={row.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
              {row.thumbnailUrl && (
                <a
                  href={row.reelUrl ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={row.thumbnailUrl}
                    alt=""
                    className="h-20 w-20 rounded object-cover"
                  />
                </a>
              )}
              <div className="flex flex-1 flex-col gap-2">
                <p className="text-sm font-medium">
                  &quot;{row.hookText}&quot;
                </p>
                {row.patternName && (
                  <div>
                    <Badge variant="outline">{row.patternName}</Badge>
                  </div>
                )}
                {row.emotionalMechanism && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Emotion: </span>
                    {row.emotionalMechanism}
                  </p>
                )}
                {row.ctaUsed && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">CTA: </span>
                    {row.ctaUsed}
                  </p>
                )}
                {row.whyItWorked && (
                  <p className="text-sm text-muted-foreground">
                    {row.whyItWorked}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {row.ownerUsername && <span>@{row.ownerUsername}</span>}
                  {row.views != null && (
                    <span>{row.views.toLocaleString()} views</span>
                  )}
                  {row.likes != null && (
                    <span>{row.likes.toLocaleString()} likes</span>
                  )}
                  {row.commentsCount != null && (
                    <span>{row.commentsCount.toLocaleString()} comments</span>
                  )}
                  {row.reelId && (
                    <Link
                      href={`/research/reel/${row.reelId}`}
                      className="hover:underline"
                    >
                      View reel
                    </Link>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hooks match &quot;{query}&quot;.
          </p>
        )}
      </div>
    </div>
  );
}
