"use client";

import { useState, useTransition } from "react";
import { WandSparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { updateFleshOutAnswers } from "./actions";

type Answer = { question: string; answer: string };

export function FleshOutView({
  entryId,
  frameworkName,
  answers,
}: {
  entryId: string;
  frameworkName: string | null;
  answers: Answer[] | null;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Answer[]>(answers ?? []);
  const [isSaving, startSaving] = useTransition();

  function startEdit() {
    setDraft(answers ?? []);
    setEditing(true);
  }

  function handleSave() {
    startSaving(async () => {
      await updateFleshOutAnswers(entryId, draft);
      setEditing(false);
    });
  }

  const shown = editing ? draft : (answers ?? []);

  return (
    <>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="shrink-0 text-primary hover:text-primary"
        title="View fleshed-out idea"
      >
        <WandSparklesIcon />
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Fleshed-out idea</DialogTitle>
            <DialogDescription>
              {frameworkName ?? "Free write"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {shown.map((a, i) => (
              <div key={i} className="flex flex-col gap-1">
                <p className="text-sm font-medium">{a.question}</p>
                {editing ? (
                  <Textarea
                    value={draft[i]?.answer ?? ""}
                    onChange={(e) =>
                      setDraft((prev) =>
                        prev.map((d, di) =>
                          di === i ? { ...d, answer: e.target.value } : d,
                        ),
                      )
                    }
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {a.answer || "(no answer)"}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button size="sm" disabled={isSaving} onClick={handleSave}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={startEdit}>
                Edit
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
