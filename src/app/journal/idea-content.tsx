"use client";

import { useState, useTransition } from "react";
import { PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateJournalContent } from "./actions";

export function IdeaContent({
  entryId,
  content,
  onSaved,
}: {
  entryId: string;
  content: string;
  onSaved?: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(content);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateJournalContent(entryId, text);
      onSaved?.(text);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <Button size="xs" disabled={isPending} onClick={handleSave}>
            {isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              setText(content);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-start gap-2 text-left"
    >
      <p className="whitespace-pre-wrap text-sm">
        {text || <span className="text-muted-foreground">(no text)</span>}
      </p>
      <PencilIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
    </button>
  );
}
