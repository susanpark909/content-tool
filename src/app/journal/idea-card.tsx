"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon, PaperclipIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IdeaContent } from "./idea-content";
import { IdeaStatus } from "./idea-status";
import { AddToBrand } from "./add-to-brand";
import { FleshOutDialog } from "./flesh-out-dialog";
import { FleshOutView } from "./flesh-out-view";

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

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatScheduledDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    dateStyle: "medium",
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
  fleshedOut,
  frameworkName,
  fleshOutAnswers,
}: {
  entryId: string;
  content: string;
  createdAt: string;
  sourceReelId: string | null;
  attachments: Attachment[];
  scheduledDate: string | null;
  posted: boolean;
  fleshedOut: boolean;
  frameworkName: string | null;
  fleshOutAnswers: FleshOutAnswer[] | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(content);
  const [currentScheduled, setCurrentScheduled] = useState(scheduledDate);
  const [currentPosted, setCurrentPosted] = useState(posted);

  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-2 text-left"
        >
          <span className="flex-1 truncate text-sm">
            {text || <span className="text-muted-foreground">(no text)</span>}
          </span>
          {currentPosted && (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              Posted
            </Badge>
          )}
          {!currentPosted && currentScheduled && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {formatScheduledDate(currentScheduled)}
            </Badge>
          )}
          {attachments.length > 0 && (
            <PaperclipIcon className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          {expanded ? (
            <ChevronUpIcon className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="mt-2 flex flex-col gap-3 border-t pt-3">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {formatTimestamp(createdAt)}
              </p>
              {sourceReelId && (
                <Link href={`/research/reel/${sourceReelId}`}>
                  <Badge variant="outline" className="text-[10px]">
                    From a reel
                  </Badge>
                </Link>
              )}
            </div>

            <IdeaContent entryId={entryId} content={text} onSaved={setText} />

            {attachments.length > 0 && (
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
                        className="h-16 w-16 rounded object-cover"
                      />
                    ) : (
                      <span className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded border text-center text-[10px] text-muted-foreground">
                        <PaperclipIcon className="size-4" />
                        <span className="line-clamp-2 px-1">{att.fileName}</span>
                      </span>
                    )}
                  </a>
                ))}
              </div>
            )}

            <IdeaStatus
              entryId={entryId}
              scheduledDate={currentScheduled}
              posted={currentPosted}
              onScheduledChange={setCurrentScheduled}
              onPostedChange={setCurrentPosted}
            />

            <div className="flex flex-wrap items-center gap-2">
              {fleshedOut ? (
                <FleshOutView
                  entryId={entryId}
                  frameworkName={frameworkName}
                  answers={fleshOutAnswers}
                />
              ) : (
                <FleshOutDialog ideaId={entryId} />
              )}
              <AddToBrand
                entryId={entryId}
                content={ideaFullText(text, frameworkName, fleshOutAnswers)}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
