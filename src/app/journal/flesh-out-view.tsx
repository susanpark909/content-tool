"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Answer = { question: string; answer: string };

export function FleshOutView({
  frameworkName,
  answers,
}: {
  frameworkName: string | null;
  answers: Answer[] | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        <Badge variant="secondary" className="cursor-pointer">
          Fleshed out
        </Badge>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Fleshed-out idea</DialogTitle>
            <DialogDescription>
              {frameworkName ?? "Framework"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {(answers ?? []).map((a, i) => (
              <div key={i} className="flex flex-col gap-1">
                <p className="text-sm font-medium">{a.question}</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {a.answer || "(no answer)"}
                </p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
