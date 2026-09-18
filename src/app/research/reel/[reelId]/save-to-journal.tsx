"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createJournalEntry } from "@/app/journal/actions";

export function SaveToJournal({ reelId }: { reelId: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (!content.trim()) return;
    setError(null);
    startSaving(async () => {
      try {
        await createJournalEntry(content, [], reelId);
        setContent("");
        setSaved(true);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setOpen(true);
            setSaved(false);
          }}
        >
          Save an idea from this reel
        </Button>
        {saved && (
          <span className="text-sm text-muted-foreground">
            Saved to your Idea Journal.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What idea do you want to save?"
        rows={3}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={isSaving || !content.trim()} onClick={handleSave}>
          {isSaving ? "Saving..." : "Save to Idea Journal"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
