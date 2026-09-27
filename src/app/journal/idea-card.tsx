"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PaperclipIcon, CalendarIcon, CircleCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AddToBrand } from "./add-to-brand";
import { ScriptDialog } from "./script-dialog";
import { scheduleIdea, setIdeaPosted } from "./actions";

type Attachment = {
  id: string;
  fileUrl: string;
  fileType: string | null;
  fileName: string | null;
};

type FleshOutAnswer = { question: string; answer: string };

function isImageType(type: string | null) {
  return Boolean(type?.startsWith("image/"));
}

function formatScheduledDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function ideaFullText(
  content: string,
  framework: string | null,
  answers: FleshOutAnswer[] | null,
) {
  const parts: string[] = [];
  if (content) parts.push(content);
  if (answers && answers.length > 0) {
    if (framework) parts.push(`Framework used: ${framework}`);
    for (const a of answers) {
      parts.push(`${a.question}\n${a.answer}`);
    }
  }
  return parts.join("\n\n");
}

export function IdeaCard({
  entryId,
  content,
  createdAt,
  sourceReelId,
  attachments,
  scheduledDate,
  posted,
  frameworkName,
  fleshOutAnswers,
  scriptId,
  scriptContent,
  scripted,
}: {
  entryId: string;
  content: string;
  createdAt: string;
  sourceReelId: string | null;
  attachments: Attachment[];
  scheduledDate: string | null;
  posted: boolean;
  frameworkName: string | null;
  fleshOutAnswers: FleshOutAnswer[] | null;
  scriptId: string | null;
  scriptContent: string;
  scripted: boolean;
}) {
  const [text, setText] = useState(content);
  const [currentScheduled, setCurrentScheduled] = useState(scheduledDate);
  const [currentPosted, setCurrentPosted] = useState(posted);
  const [currentScripted, setCurrentScripted] = useState(scripted);

  const [editOpen, setEditOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [isTogglingPosted, startTogglingPosted] = useTransition();

  function togglePosted() {
    const next = !currentPosted;
    startTogglingPosted(async () => {
      await setIdeaPosted(entryId, next);
      setCurrentPosted(next);
    });
  }

  return (
    <div className="flex h-9 items-center gap-2 rounded-md border px-2.5">
      <button
        onClick={() => setEditOpen(true)}
        className="min-w-0 flex-1 truncate text-left text-sm"
      >
        {text || <span className="text-muted-foreground">(no text)</span>}
      </button>

      {currentScripted && (
        <Badge className="shrink-0 text-[10px]">Scripted</Badge>
      )}

      {sourceReelId && (
        <Link
          href={`/research/reel/${sourceReelId}`}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          title="From a reel"
        >
          <Badge variant="outline" className="text-[10px]">
            reel
          </Badge>
        </Link>
      )}

      {attachments.length > 0 && (
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => setAttachOpen(true)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          title={`${attachments.length} attachment${attachments.length === 1 ? "" : "s"}`}
        >
          <PaperclipIcon />
        </Button>
      )}

      <Button
        size="icon-xs"
        variant="ghost"
        onClick={() => setScheduleOpen(true)}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        title={
          currentScheduled
            ? `Scheduled: ${formatScheduledDate(currentScheduled)}`
            : "Schedule"
        }
      >
        {currentScheduled ? (
          <span className="text-[10px] font-medium text-foreground">
            {formatScheduledDate(currentScheduled)}
          </span>
        ) : (
          <CalendarIcon />
        )}
      </Button>

      <Button
        size="icon-xs"
        variant="ghost"
        disabled={isTogglingPosted}
        onClick={togglePosted}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        title={currentPosted ? "Posted — click to unmark" : "Mark as posted"}
      >
        <CircleCheckIcon className={currentPosted ? "fill-primary text-primary-foreground" : undefined} />
      </Button>

      <AddToBrand
        entryId={entryId}
        content={ideaFullText(text, frameworkName, fleshOutAnswers)}
      />

      <ScriptDialog
        entryId={entryId}
        ideaText={text}
        scriptId={scriptId}
        scriptContent={scriptContent}
        scheduledDate={currentScheduled}
        scripted={currentScripted}
        open={editOpen}
        onOpenChange={setEditOpen}
        onIdeaTextSaved={setText}
        onScheduledDateSaved={setCurrentScheduled}
        onScriptedSaved={setCurrentScripted}
      />

      <ScheduleDialog
        entryId={entryId}
        scheduledDate={currentScheduled}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onSaved={setCurrentScheduled}
      />

      {attachments.length > 0 && (
        <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Attachments</DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              {attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block"
                >
                  {isImageType(att.fileType) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={att.fileUrl}
                      alt=""
                      className="h-20 w-20 rounded object-cover"
                    />
                  ) : (
                    <span className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded border text-center text-[10px] text-muted-foreground">
                      <PaperclipIcon className="size-4" />
                      <span className="line-clamp-2 px-1">{att.fileName}</span>
                    </span>
                  )}
                </a>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ScheduleDialog({
  entryId,
  scheduledDate,
  open,
  onOpenChange,
  onSaved,
}: {
  entryId: string;
  scheduledDate: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (date: string | null) => void;
}) {
  const [date, setDate] = useState(scheduledDate ?? "");
  const [isPending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (next) setDate(scheduledDate ?? "");
    onOpenChange(next);
  }

  function handleSave() {
    startTransition(async () => {
      await scheduleIdea(entryId, date || null);
      onSaved(date || null);
      onOpenChange(false);
    });
  }

  function handleUnschedule() {
    startTransition(async () => {
      await scheduleIdea(entryId, null);
      onSaved(null);
      setDate("");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule</DialogTitle>
        </DialogHeader>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          autoFocus
        />
        <DialogFooter>
          {scheduledDate && (
            <Button variant="ghost" disabled={isPending} onClick={handleUnschedule}>
              Unschedule
            </Button>
          )}
          <Button disabled={isPending} onClick={handleSave}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
