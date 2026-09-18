"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type FrameworkExample = {
  id: string;
  note: string | null;
  reelId: string | null;
  reelUrl: string | null;
  ownerUsername: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  views: number | null;
  likes: number | null;
  commentsCount: number | null;
};

export type FrameworkRow = {
  id: string;
  name: string;
  description: string | null;
  examples: FrameworkExample[];
};

export function FrameworkLibraryClient({
  frameworks,
}: {
  frameworks: FrameworkRow[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return frameworks;
    return frameworks.filter((f) =>
      [f.name, f.description, ...f.examples.map((e) => e.ownerUsername)]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [frameworks, query]);

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Search frameworks or creators..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      <div className="flex flex-col gap-4">
        {filtered.map((framework) => (
          <Card key={framework.id}>
            <CardContent className="flex flex-col gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{framework.name}</p>
                  <Badge variant="outline">
                    {framework.examples.length} example
                    {framework.examples.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                {framework.description && (
                  <p className="text-sm text-muted-foreground">
                    {framework.description}
                  </p>
                )}
              </div>

              {framework.examples.length > 0 && (
                <div className="flex flex-col gap-2 border-t pt-3">
                  {framework.examples.map((ex) => (
                    <div key={ex.id} className="flex gap-3">
                      {ex.thumbnailUrl && (
                        <a
                          href={ex.reelUrl ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ex.thumbnailUrl}
                            alt=""
                            className="h-14 w-14 rounded object-cover"
                          />
                        </a>
                      )}
                      <div className="flex flex-col gap-1 text-sm">
                        {ex.note && <p>{ex.note}</p>}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {ex.ownerUsername && <span>@{ex.ownerUsername}</span>}
                          {ex.views != null && (
                            <span>{ex.views.toLocaleString()} views</span>
                          )}
                          {ex.likes != null && (
                            <span>{ex.likes.toLocaleString()} likes</span>
                          )}
                          {ex.reelId && (
                            <Link
                              href={`/research/reel/${ex.reelId}`}
                              className="hover:underline"
                            >
                              View reel
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No frameworks match &quot;{query}&quot;.
          </p>
        )}
      </div>
    </div>
  );
}
