"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { SavedReelRow } from "./saved-reels-client";

export function ScriptsLibraryClient({ rows }: { rows: SavedReelRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.hookText, r.bodyText, r.ctaText, r.caption, r.ownerUsername]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [rows, query]);

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Search scripts, creators..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      <div className="flex flex-col gap-3">
        {filtered.map((row) => (
          <ScriptCard key={row.id} row={row} />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {rows.length === 0
              ? "Nothing saved yet — transcribe a reel from its Reel Detail page and its full script will show up here automatically."
              : `Nothing matches "${query}".`}
          </p>
        )}
      </div>
    </div>
  );
}

function ScriptCard({ row }: { row: SavedReelRow }) {
  const [expanded, setExpanded] = useState(false);
  const fullScript = [row.hookText, row.bodyText, row.ctaText]
    .filter(Boolean)
    .join("\n\n");

  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-start gap-3 text-left"
        >
          <div className="flex flex-1 flex-col gap-1">
            <span className="line-clamp-2 text-sm font-medium">
              {row.hookText}
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {row.ownerUsername && (
                <span className="flex items-center gap-1.5">
                  {row.ownerAvatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.ownerAvatarUrl}
                      alt=""
                      className="size-4 rounded-full object-cover"
                    />
                  )}
                  @{row.ownerUsername}
                </span>
              )}
              {row.views != null && <span>{row.views.toLocaleString()} views</span>}
              {row.likes != null && <span>{row.likes.toLocaleString()} likes</span>}
              {row.commentsCount != null && (
                <span>{row.commentsCount.toLocaleString()} comments</span>
              )}
              {row.sharesCount != null && (
                <span>{row.sharesCount.toLocaleString()} shares</span>
              )}
            </div>
          </div>
          {expanded ? (
            <ChevronUpIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDownIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="mt-2 flex flex-col gap-3 border-t pt-3">
            <p className="whitespace-pre-wrap text-sm">{fullScript}</p>
            <div className="pt-1">
              <Link href={`/research/reel/${row.id}`} className="text-xs hover:underline">
                View reel
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
