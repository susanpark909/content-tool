"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  createFramework,
  updateFramework,
  deleteFramework,
  deleteFrameworkExample,
} from "./framework-actions";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [showAddForm, setShowAddForm] = useState(false);

  function updateQuery(value: string) {
    setQuery(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    router.replace(`?${params.toString()}`, { scroll: false });
  }

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search frameworks or creators..."
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          className="max-w-sm"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddForm((v) => !v)}
          className="self-start sm:self-auto"
        >
          {showAddForm ? "Cancel" : "Add framework"}
        </Button>
      </div>

      {showAddForm && (
        <FrameworkForm
          onCancel={() => setShowAddForm(false)}
          onSave={async (name, description) => {
            await createFramework(name, description);
            setShowAddForm(false);
          }}
          saveLabel="Save framework"
        />
      )}

      <div className="flex flex-col gap-4">
        {filtered.map((framework) => (
          <FrameworkCard key={framework.id} framework={framework} />
        ))}
        {filtered.length === 0 && !showAddForm && (
          <p className="text-sm text-muted-foreground">
            {frameworks.length === 0
              ? "No frameworks yet. Add one above."
              : `No frameworks match "${query}".`}
          </p>
        )}
      </div>
    </div>
  );
}

function FrameworkCard({ framework }: { framework: FrameworkRow }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, startDeleting] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startDeleting(async () => {
      try {
        await deleteFramework(framework.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  if (editing) {
    return (
      <FrameworkForm
        initial={framework}
        onCancel={() => setEditing(false)}
        onSave={async (name, description) => {
          await updateFramework(framework.id, name, description);
          setEditing(false);
        }}
        saveLabel="Save changes"
      />
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-start justify-between gap-3">
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
          <div className="flex shrink-0 items-center gap-1">
            {confirmingDelete ? (
              <>
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
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setEditing(true)}
                  aria-label="Edit framework"
                >
                  <PencilIcon />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmingDelete(true)}
                  aria-label="Delete framework"
                >
                  <Trash2Icon />
                </Button>
              </>
            )}
          </div>
        </div>
        {confirmingDelete && (
          <p className="text-xs text-muted-foreground">
            This also removes its {framework.examples.length} saved example
            {framework.examples.length === 1 ? "" : "s"}.
          </p>
        )}

        {framework.examples.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-3">
            {framework.examples.map((ex) => (
              <FrameworkExampleRow key={ex.id} example={ex} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FrameworkExampleRow({ example }: { example: FrameworkExample }) {
  const [isRemoving, startRemoving] = useTransition();

  return (
    <div className="flex gap-3">
      <div className="flex flex-1 flex-col gap-1 text-sm">
        {example.note && <p>{example.note}</p>}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {example.ownerUsername && <span>@{example.ownerUsername}</span>}
          {example.views != null && (
            <span>{example.views.toLocaleString()} views</span>
          )}
          {example.likes != null && (
            <span>{example.likes.toLocaleString()} likes</span>
          )}
          {example.reelId && (
            <Link href={`/research/reel/${example.reelId}`} className="hover:underline">
              View reel
            </Link>
          )}
          <button
            disabled={isRemoving}
            onClick={() =>
              startRemoving(async () => {
                await deleteFrameworkExample(example.id);
              })
            }
            className="text-destructive hover:underline"
          >
            {isRemoving ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FrameworkForm({
  initial,
  onCancel,
  onSave,
  saveLabel,
}: {
  initial?: { name: string; description: string | null };
  onCancel: () => void;
  onSave: (name: string, description: string | null) => Promise<void>;
  saveLabel: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!name.trim()) {
      setError("Framework name is required");
      return;
    }
    setError(null);
    startSaving(async () => {
      try {
        await onSave(name, description.trim() || null);
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
          <Label htmlFor="framework-form-name">Name</Label>
          <Input
            id="framework-form-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Problem → misconception → truth → solution"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="framework-form-description">Description</Label>
          <Textarea
            id="framework-form-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
