"use client";

import { useState, useTransition } from "react";
import { CalendarIcon, CircleCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { updateJournalContent, scheduleIdea, setIdeaScripted } from "./actions";
import { createManualScript, updateScriptContent } from "@/app/plan/script-actions";

export function ScriptDialog({
  entryId,
  ideaText,
  scriptId,
  scriptContent,
  scheduledDate,
  scripted,
  open,
  onOpenChange,
  onIdeaTextSaved,
  onScheduledDateSaved,
  onScriptedSaved,
}: {
  entryId: string;
  ideaText: string;
  scriptId: string | null;
  scriptContent: string;
  scheduledDate: string | null;
  scripted: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIdeaTextSaved: (text: string) => void;
  onScheduledDateSaved: (date: string | null) => void;
  onScriptedSaved: (scripted: boolean) => void;
}) {
  const [idea, setIdea] = useState(ideaText);
  const [currentScriptId, setCurrentScriptId] = useState(scriptId);
  const [script, setScript] = useState(scriptContent);
  const [savedScript, setSavedScript] = useState(scriptContent);
  const [date, setDate] = useState(scheduledDate ?? "");
  const [isScripted, setIsScripted] = useState(scripted);
  const [isSavingIdea, startSavingIdea] = useTransition();
  const [isSavingScript, startSavingScript] = useTransition();
  const [isSavingDate, startSavingDate] = useTransition();
  const [isTogglingScripted, startTogglingScripted] = useTransition();

  function handleOpenChange(next: boolean) {
    if (next) {
      setIdea(ideaText);
      setCurrentScriptId(scriptId);
      setScript(scriptContent);
      setSavedScript(scriptContent);
      setDate(scheduledDate ?? "");
      setIsScripted(scripted);
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

  function handleDateChange(value: string) {
    setDate(value);
    startSavingDate(async () => {
      await scheduleIdea(entryId, value || null);
      onScheduledDateSaved(value || null);
    });
  }

  function toggleScripted() {
    const next = !isScripted;
    setIsScripted(next);
    startTogglingScripted(async () => {
      await setIdeaScripted(entryId, next);
      onScriptedSaved(next);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName="backdrop-blur-md bg-background/50"
        className="flex h-[88vh] max-h-[88vh] w-[94vw] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b p-4 pr-10">
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onBlur={handleIdeaBlur}
            placeholder="What's the idea?"
            className="min-h-9 flex-1 resize-none border-none bg-transparent px-0 py-0 text-base font-medium shadow-none focus-visible:ring-0"
          />
          {isScripted && (
            <Badge className="shrink-0">
              <CircleCheckIcon />
              Scripted
            </Badge>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-4">
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Write your script here..."
            autoFocus
            className="h-full w-full resize-none overflow-y-auto rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={isScripted ? "default" : "outline"}
              disabled={isTogglingScripted}
              onClick={toggleScripted}
            >
              <CircleCheckIcon />
              {isScripted ? "Scripted" : "Mark as Scripted"}
            </Button>

            <div className="flex items-center gap-1.5">
              <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
              <Input
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="h-8 w-auto"
              />
              {date && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isSavingDate}
                  onClick={() => handleDateChange("")}
                >
                  Unschedule
                </Button>
              )}
            </div>
          </div>

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
