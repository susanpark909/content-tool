"use client";

import { useState, useTransition } from "react";
import { CalendarIcon, CircleCheckIcon, PaperclipIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AddToBrand } from "./add-to-brand";
import { updateJournalContent, scheduleIdea, setIdeaScripted, setIdeaPosted } from "./actions";
import { createManualScript, updateScriptContent } from "@/app/plan/script-actions";

type Attachment = {
  id: string;
  fileUrl: string;
  fileType: string | null;
  fileName: string | null;
};

export function ScriptDialog({
  entryId,
  ideaText,
  scriptId,
  scriptContent,
  scheduledDate,
  scripted,
  posted,
  attachments,
  brandContent,
  open,
  onOpenChange,
  onIdeaTextSaved,
  onScheduledDateSaved,
  onScriptedSaved,
  onPostedSaved,
}: {
  entryId: string;
  ideaText: string;
  scriptId: string | null;
  scriptContent: string;
  scheduledDate: string | null;
  scripted: boolean;
  posted: boolean;
  attachments: Attachment[];
  brandContent: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIdeaTextSaved: (text: string) => void;
  onScheduledDateSaved: (date: string | null) => void;
  onScriptedSaved: (scripted: boolean) => void;
  onPostedSaved: (posted: boolean) => void;
}) {
  const [idea, setIdea] = useState(ideaText);
  const [currentScriptId, setCurrentScriptId] = useState(scriptId);
  const [script, setScript] = useState(scriptContent);
  const [savedScript, setSavedScript] = useState(scriptContent);
  const [date, setDate] = useState(scheduledDate ?? "");
  const [isScripted, setIsScripted] = useState(scripted);
  const [isPosted, setIsPosted] = useState(posted);
  const [isSavingIdea, startSavingIdea] = useTransition();
  const [isSavingScript, startSavingScript] = useTransition();
  const [isSavingDate, startSavingDate] = useTransition();
  const [isTogglingScripted, startTogglingScripted] = useTransition();
  const [isTogglingPosted, startTogglingPosted] = useTransition();

  function handleOpenChange(next: boolean) {
    if (next) {
      setIdea(ideaText);
      setCurrentScriptId(scriptId);
      setScript(scriptContent);
      setSavedScript(scriptContent);
      setDate(scheduledDate ?? "");
      setIsScripted(scripted);
      setIsPosted(posted);
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

  function togglePosted() {
    const next = !isPosted;
    setIsPosted(next);
    startTogglingPosted(async () => {
      await setIdeaPosted(entryId, next);
      onPostedSaved(next);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName="backdrop-blur-md bg-[#0D0D0D]/45"
        className="flex h-[88vh] max-h-[88vh] w-[94vw] max-w-4xl flex-col gap-0 overflow-hidden rounded-[8px] border-2 border-[#0D0D0D] bg-[#FBFBFA] p-0 sm:max-w-4xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b-2 border-[#0D0D0D] p-4 pr-12">
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onBlur={handleIdeaBlur}
            placeholder="What's the idea?"
            className="min-h-9 flex-1 resize-none border-none bg-transparent px-0 py-0 text-lg font-bold shadow-none focus-visible:ring-0"
          />
          <div className="flex shrink-0 items-center gap-2">
            {attachments.length > 0 && (
              <span
                className="flex items-center gap-1 text-xs font-semibold text-[#4a4a48]"
                title={attachments.map((a) => a.fileName).join(", ")}
              >
                <PaperclipIcon className="size-3.5" />
                {attachments.length} file{attachments.length === 1 ? "" : "s"}
              </span>
            )}
            <AddToBrand entryId={entryId} content={brandContent} />
            {isPosted && (
              <Badge className="shrink-0 bg-[#0D0D0D] text-[#F6F6F5]">
                <span className="size-1.5 rounded-full bg-[#C6FF3D]" />
                Posted
              </Badge>
            )}
            {isScripted && !isPosted && (
              <Badge className="shrink-0 bg-[#FFD9EB] text-[#0D0D0D]">
                <CircleCheckIcon className="text-[#FF1F8F]" />
                Scripted
              </Badge>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-4">
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Write your script here..."
            autoFocus
            className="h-full w-full resize-none overflow-y-auto rounded-[4px] border border-[#CFCFCD] bg-[#F6F6F5] px-3 py-2.5 text-[15px] leading-[1.5] outline-none placeholder:text-[#4a4a48]/60 focus-visible:border-[#0D0D0D]"
          />
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t-2 border-[#0D0D0D] bg-[#F6F6F5] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={isScripted ? "default" : "outline"}
              disabled={isTogglingScripted}
              onClick={toggleScripted}
              className="rounded-[4px]"
            >
              <CircleCheckIcon />
              {isScripted ? "Scripted" : "Mark as Scripted"}
            </Button>

            <Button
              type="button"
              size="sm"
              variant={isPosted ? "default" : "outline"}
              disabled={isTogglingPosted}
              onClick={togglePosted}
              className="rounded-[4px]"
            >
              <CircleCheckIcon />
              {isPosted ? "Posted" : "Mark as Posted"}
            </Button>

            <div className="flex items-center gap-1.5">
              <CalendarIcon className="size-4 shrink-0 text-[#4a4a48]" />
              <Input
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="h-8 w-auto rounded-[4px]"
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
            className="rounded-[4px] bg-[#FF1F8F] text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F]"
          >
            {isSavingScript ? "Saving..." : "Save script"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
