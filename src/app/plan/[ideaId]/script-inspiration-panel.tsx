"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDownIcon, ChevronRightIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  getScriptInspiration,
  type ScriptInspirationRow,
} from "./script-inspiration-actions";

export function ScriptInspirationPanel({ ideaContent }: { ideaContent: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [suggested, setSuggested] = useState<ScriptInspirationRow[]>([]);
  const [all, setAll] = useState<ScriptInspirationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function handleOpen() {
    setOpen(true);
    if (loaded) return;
    startTransition(async () => {
      try {
        const result = await getScriptInspiration(ideaContent);
        setSuggested(result.suggested);
        setAll(result.all);
        setLoaded(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load saved scripts");
      }
    });
  }

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return all.filter((r) =>
      [r.hookText, r.bodyText, r.ctaText, r.ownerUsername]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q)),
    );
  }, [all, query]);

  const selected = all.find((r) => r.id === selectedId) ?? null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <button
          onClick={() => (open ? setOpen(false) : handleOpen())}
          className="flex items-center gap-2 text-sm font-medium"
        >
          {open ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
          Pull in a script for inspiration
        </button>

        {open && (
          <div className="flex flex-col gap-4">
            {isPending && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" /> Finding fitting scripts...
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}

            {loaded && !isPending && (
              <>
                {suggested.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <SparklesIcon className="size-3.5" /> Suggested for this idea
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {suggested.map((row) => (
                        <button
                          key={row.id}
                          onClick={() => setSelectedId(row.id)}
                          className="rounded-md border p-2.5 text-left text-sm hover:bg-accent"
                        >
                          <p className="line-clamp-1 font-medium">{row.hookText}</p>
                          {row.reason && (
                            <p className="text-xs text-muted-foreground">{row.reason}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {suggested.length === 0 && all.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nothing in your Library felt like a strong fit for this idea — search below.
                  </p>
                )}
                {all.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nothing saved to your Library yet — transcribe a reel to start
                    building it.
                  </p>
                )}

                {all.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <Input
                      placeholder="Search your saved scripts..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query.trim() && (
                      <div className="flex flex-col gap-1.5">
                        {searchResults.map((row) => (
                          <button
                            key={row.id}
                            onClick={() => setSelectedId(row.id)}
                            className="rounded-md border p-2.5 text-left text-sm hover:bg-accent"
                          >
                            <p className="line-clamp-1 font-medium">{row.hookText}</p>
                            {row.ownerUsername && (
                              <p className="text-xs text-muted-foreground">
                                @{row.ownerUsername}
                              </p>
                            )}
                          </button>
                        ))}
                        {searchResults.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            Nothing matches &quot;{query}&quot;.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {selected && (
                  <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {selected.ownerAvatarUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={selected.ownerAvatarUrl}
                            alt=""
                            className="size-4 rounded-full object-cover"
                          />
                        )}
                        {selected.ownerUsername && <span>@{selected.ownerUsername}</span>}
                        {selected.views != null && (
                          <span>{selected.views.toLocaleString()} views</span>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
                        Close
                      </Button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">
                      {[selected.hookText, selected.bodyText, selected.ctaText]
                        .filter(Boolean)
                        .join("\n\n")}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
