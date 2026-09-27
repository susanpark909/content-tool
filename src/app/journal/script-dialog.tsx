"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { updateJournalContent } from "./actions";
import { createManualScript, updateScriptContent } from "@/app/plan/script-actions";

export function ScriptDialog({
  entryId,
  ideaText,
  scriptId,
  scriptContent,
  open,
  onOpenChange,
  onIdeaTextSaved,
}: {
  entryId: string;
  ideaText: string;
  scriptId: string | null;
  scriptContent: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIdeaTextSaved: (text: string) => void;
}) {
  const [idea, setIdea] = useState(ideaText);
  const [currentScriptId, setCurrentScriptId] = useState(scriptId);
  const [script, setScript] = useState(scriptContent);
  const [savedScript, setSavedScript] = useState(scriptContent);
  const [isSavingIdea, startSavingIdea] = useTransition();
  const [isSavingScript, startSavingScript] = useTransition();

  function handleOpenChange(next: boolean) {
    if (next) {
      setIdea(ideaText);
      setCurrentScriptId(scriptId);
      setScript(scriptContent);
      setSavedScript(scriptContent);
    }
    onOpenChange(next);
  }

  function handleIdeaBlur() {
    if (idea === ideaText) return;
    startSavingIdea(async () => {
      await updateJournalContent(entryId, idea);
      onIdeaTextSaved(idea);
    });
  }

  function handleSaveScript() {
    startSavingScript(async () => {
      if (currentScriptId) {
        await updateScriptContent(currentScriptId, script);
      } else {
        const newId = await createManualScript(entryId, script);
        if (newId) setCurrentScriptId(newId);
      }
      setSavedScript(script);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName="backdrop-blur-md bg-background/50"
        className="flex h-[88vh] w-[94vw] max-w-4xl flex-col gap-0 p-0 sm:max-w-4xl"
      >
        <div className="border-b p-4 pr-10">
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onBlur={handleIdeaBlur}
            placeholder="What's the idea?"
            className="min-h-9 resize-none border-none bg-transparent px-0 py-0 text-base font-medium shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex flex-1 flex-col p-4">
          <Textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Write your script here..."
            className="min-h-0 flex-1 resize-none text-sm"
            autoFocus
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t bg-muted/50 p-4">
          <span className="text-xs text-muted-foreground">
            {isSavingIdea ? "Saving idea..." : " "}
          </span>
          <Button
            disabled={isSavingScript || script === savedScript}
            onClick={handleSaveScript}
          >
            {isSavingScript ? "Saving..." : "Save script"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
