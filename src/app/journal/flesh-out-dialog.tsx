"use client";

import { useState, useTransition } from "react";
import { WandSparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  matchFrameworks,
  getFollowUpQuestions,
  saveFleshOut,
  type FrameworkMatch,
} from "./actions";

type Step =
  | "idle"
  | "start"
  | "matching"
  | "choosing"
  | "loadingQuestions"
  | "answering"
  | "freewrite"
  | "saving"
  | "error";

export function FleshOutDialog({ ideaId }: { ideaId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<FrameworkMatch[]>([]);
  const [selectedFrameworkId, setSelectedFrameworkId] = useState<string>("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [freeWriteText, setFreeWriteText] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setStep("idle");
    setError(null);
    setMatches([]);
    setSelectedFrameworkId("");
    setQuestions([]);
    setAnswers([]);
    setFreeWriteText("");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function startFleshOut() {
    setOpen(true);
    setStep("start");
  }

  function startFrameworkMatching() {
    setStep("matching");
    startTransition(async () => {
      try {
        const result = await matchFrameworks(ideaId);
        setMatches(result);
        setStep("choosing");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setStep("error");
      }
    });
  }

  function confirmFramework() {
    if (!selectedFrameworkId) return;
    setStep("loadingQuestions");
    startTransition(async () => {
      try {
        const qs = await getFollowUpQuestions(ideaId, selectedFrameworkId);
        setQuestions(qs);
        setAnswers(qs.map(() => ""));
        setStep("answering");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setStep("error");
      }
    });
  }

  function submitAnswers() {
    setStep("saving");
    startTransition(async () => {
      try {
        await saveFleshOut(
          ideaId,
          selectedFrameworkId,
          questions.map((question, i) => ({
            question,
            answer: answers[i] ?? "",
          })),
        );
        setOpen(false);
        reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setStep("error");
      }
    });
  }

  function submitFreeWrite() {
    if (!freeWriteText.trim()) return;
    setStep("saving");
    startTransition(async () => {
      try {
        await saveFleshOut(ideaId, null, [
          { question: "Your notes", answer: freeWriteText },
        ]);
        setOpen(false);
        reset();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setStep("error");
      }
    });
  }

  return (
    <>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={startFleshOut}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        title="Flesh this out"
      >
        <WandSparklesIcon />
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Flesh this out</DialogTitle>
            <DialogDescription>
              {step === "start" &&
                "Want AI to suggest a framework, or just write it out yourself?"}
              {step === "matching" && "Finding the best-fit frameworks..."}
              {step === "choosing" &&
                "Pick the framework that fits this idea best."}
              {step === "loadingQuestions" &&
                "Generating follow-up questions..."}
              {step === "answering" &&
                "Answer as many as you can, then save."}
              {step === "freewrite" &&
                "Skip the framework — just write out the idea however it comes."}
              {step === "saving" && "Saving..."}
              {step === "error" && "Something went wrong."}
            </DialogDescription>
          </DialogHeader>

          {(step === "matching" || step === "loadingQuestions") && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Thinking...
            </p>
          )}

          {step === "choosing" && (
            <RadioGroup
              value={selectedFrameworkId}
              onValueChange={setSelectedFrameworkId}
              className="gap-3"
            >
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <RadioGroupItem
                    value={m.id}
                    id={m.id}
                    className="mt-1"
                  />
                  <Label htmlFor={m.id} className="flex-1 cursor-pointer">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-sm font-normal text-muted-foreground">
                      {m.reason}
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}

          {step === "freewrite" && (
            <Textarea
              value={freeWriteText}
              onChange={(e) => setFreeWriteText(e.target.value)}
              placeholder="Write out whatever you've got — no structure required."
              rows={8}
              autoFocus
            />
          )}

          {step === "answering" && (
            <div className="flex flex-col gap-4">
              {questions.map((q, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <Label className="text-sm">{q}</Label>
                  <Textarea
                    value={answers[i] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    rows={3}
                  />
                </div>
              ))}
            </div>
          )}

          {step === "error" && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter className={step === "start" ? "sm:justify-between" : undefined}>
            {step === "start" && (
              <>
                <Button variant="ghost" onClick={() => setStep("freewrite")}>
                  Just free-write instead
                </Button>
                <Button onClick={startFrameworkMatching}>
                  Suggest a framework
                </Button>
              </>
            )}
            {step === "choosing" && (
              <Button
                onClick={confirmFramework}
                disabled={!selectedFrameworkId || isPending}
              >
                Continue
              </Button>
            )}
            {step === "answering" && (
              <Button onClick={submitAnswers} disabled={isPending}>
                Save
              </Button>
            )}
            {step === "freewrite" && (
              <>
                <Button variant="outline" onClick={() => setStep("start")} disabled={isPending}>
                  Back
                </Button>
                <Button onClick={submitFreeWrite} disabled={!freeWriteText.trim() || isPending}>
                  Save
                </Button>
              </>
            )}
            {step === "error" && (
              <Button variant="outline" onClick={startFleshOut}>
                Try again
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
