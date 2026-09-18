"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  applyBrandProfileNote,
  dismissBrandProfileNote,
} from "./actions";

export type PendingNote = {
  id: string;
  content: string;
  sourceEntryId: string | null;
};

export function PendingNotes({ notes }: { notes: PendingNote[] }) {
  const [items, setItems] = useState(notes);

  if (items.length === 0) return null;

  return (
    <Card className="border-primary/30">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">Waiting for review</p>
          <Badge variant="secondary">{items.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Sent over from Idea. Edit if you want, then add — nothing here
          touches your profile until you say so.
        </p>
        <div className="flex flex-col gap-3">
          {items.map((note) => (
            <PendingNoteRow
              key={note.id}
              note={note}
              onResolved={(id) =>
                setItems((prev) => prev.filter((n) => n.id !== id))
              }
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PendingNoteRow({
  note,
  onResolved,
}: {
  note: PendingNote;
  onResolved: (id: string) => void;
}) {
  const [text, setText] = useState(note.content);
  const [isApplying, startApplying] = useTransition();
  const [isDismissing, startDismissing] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleApply() {
    setError(null);
    startApplying(async () => {
      try {
        await applyBrandProfileNote(note.id, text);
        onResolved(note.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleDismiss() {
    setError(null);
    startDismissing(async () => {
      try {
        await dismissBrandProfileNote(note.id);
        onResolved(note.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const busy = isApplying || isDismissing;

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} />
      {note.sourceEntryId && (
        <Link
          href="/journal"
          className="text-xs text-muted-foreground hover:underline"
        >
          From Idea
        </Link>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !text.trim()} onClick={handleApply}>
          {isApplying ? "Adding..." : "Add to profile"}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={handleDismiss}>
          {isDismissing ? "Dismissing..." : "Dismiss"}
        </Button>
      </div>
    </div>
  );
}
