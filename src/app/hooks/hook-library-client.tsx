"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { createHook, updateHook, deleteHook, type HookFields } from "./actions";

export type HookRow = {
  id: string;
  hookText: string;
  patternId: string | null;
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

type LibraryOption = { id: string; name: string };

export function HookLibraryClient({
  rows,
  hookPatterns,
}: {
  rows: HookRow[];
  hookPatterns: LibraryOption[];
}) {
  const [query, setQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search hooks, patterns, emotions, creators..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddForm((v) => !v)}
          className="self-start sm:self-auto"
        >
          {showAddForm ? "Cancel" : "Add hook"}
        </Button>
      </div>

      {showAddForm && (
        <HookForm
          hookPatterns={hookPatterns}
          onCancel={() => setShowAddForm(false)}
          onSave={async (fields) => {
            await createHook(fields);
            setShowAddForm(false);
          }}
          saveLabel="Save hook"
        />
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((row) => (
          <HookCard
            key={row.id}
            row={row}
            hookPatterns={hookPatterns}
            onFilterPattern={(name) => setQuery(name)}
          />
        ))}
        {filtered.length === 0 && !showAddForm && (
          <p className="text-sm text-muted-foreground">
            {rows.length === 0
              ? "No hooks saved yet. Analyze a transcribed reel from its Reel Detail page, or add one manually above."
              : `No hooks match "${query}".`}
          </p>
        )}
      </div>
    </div>
  );
}

function HookCard({
  row,
  hookPatterns,
  onFilterPattern,
}: {
  row: HookRow;
  hookPatterns: LibraryOption[];
  onFilterPattern: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, startDeleting] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startDeleting(async () => {
      try {
        await deleteHook(row.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  if (editing) {
    return (
      <Card>
        <CardContent className="p-4">
          <HookForm
            hookPatterns={hookPatterns}
            initial={row}
            onCancel={() => setEditing(false)}
            onSave={async (fields) => {
              await updateHook(row.id, fields);
              setEditing(false);
            }}
            saveLabel="Save changes"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-start gap-3 text-left"
        >
          {row.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.thumbnailUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded object-cover"
            />
          )}
          <span className="flex-1 text-sm font-medium">
            &quot;{row.hookText}&quot;
          </span>
          {expanded ? (
            <ChevronUpIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDownIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="mt-2 flex flex-col gap-2 border-t pt-3">
            {error && <p className="text-sm text-destructive">{error}</p>}
            {row.patternName && (
              <div>
                <button onClick={() => onFilterPattern(row.patternName!)}>
                  <Badge variant="outline" className="cursor-pointer">
                    {row.patternName}
                  </Badge>
                </button>
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
              <p className="text-sm text-muted-foreground">{row.whyItWorked}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {row.ownerUsername && <span>@{row.ownerUsername}</span>}
              {row.views != null && <span>{row.views.toLocaleString()} views</span>}
              {row.likes != null && <span>{row.likes.toLocaleString()} likes</span>}
              {row.commentsCount != null && (
                <span>{row.commentsCount.toLocaleString()} comments</span>
              )}
              {row.reelId && (
                <Link href={`/research/reel/${row.reelId}`} className="hover:underline">
                  View reel
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1">
              {confirmingDelete ? (
                <>
                  <span className="text-sm text-muted-foreground">Delete this hook?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isDeleting}
                    onClick={handleDelete}
                  >
                    {isDeleting ? "Deleting..." : "Yes, delete"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isDeleting}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HookForm({
  hookPatterns,
  initial,
  onCancel,
  onSave,
  saveLabel,
}: {
  hookPatterns: LibraryOption[];
  initial?: HookRow;
  onCancel: () => void;
  onSave: (fields: HookFields) => Promise<void>;
  saveLabel: string;
}) {
  const [hookText, setHookText] = useState(initial?.hookText ?? "");
  const [patternId, setPatternId] = useState(initial?.patternId ?? "none");
  const [emotionalMechanism, setEmotionalMechanism] = useState(
    initial?.emotionalMechanism ?? "",
  );
  const [ctaUsed, setCtaUsed] = useState(initial?.ctaUsed ?? "");
  const [whyItWorked, setWhyItWorked] = useState(initial?.whyItWorked ?? "");
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!hookText.trim()) {
      setError("Hook text is required");
      return;
    }
    setError(null);
    startSaving(async () => {
      try {
        await onSave({
          hookText,
          patternId: patternId === "none" ? null : patternId,
          emotionalMechanism,
          ctaUsed: ctaUsed.trim() || null,
          whyItWorked,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hook-form-text">Hook text</Label>
          <Textarea
            id="hook-form-text"
            value={hookText}
            onChange={(e) => setHookText(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Pattern</Label>
          <Select value={patternId} onValueChange={(v) => setPatternId(v ?? "none")}>
            <SelectTrigger>
              <SelectValue>
                {(value: string) =>
                  value === "none"
                    ? "No pattern"
                    : (hookPatterns.find((p) => p.id === value)?.name ?? "No pattern")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No pattern</SelectItem>
              {hookPatterns.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hook-form-emotion">Emotional mechanism</Label>
            <Input
              id="hook-form-emotion"
              value={emotionalMechanism}
              onChange={(e) => setEmotionalMechanism(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hook-form-cta">CTA used</Label>
            <Input
              id="hook-form-cta"
              value={ctaUsed}
              onChange={(e) => setCtaUsed(e.target.value)}
              placeholder="—"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hook-form-why">Why it worked</Label>
          <Textarea
            id="hook-form-why"
            value={whyItWorked}
            onChange={(e) => setWhyItWorked(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <Button size="sm" disabled={isSaving} onClick={handleSave}>
            {isSaving ? "Saving..." : saveLabel}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
