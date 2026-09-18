"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  matchHookPatterns,
  matchFrameworksForScript,
  getScriptQuestions,
  generateScript,
  updateScriptContent,
  type PatternMatch,
} from "../actions";
import { ANGLES } from "../constants";

type Step =
  | "angle"
  | "matchingHooks"
  | "hook"
  | "matchingFrameworks"
  | "framework"
  | "loadingQuestions"
  | "questions"
  | "generating"
  | "result"
  | "error";

export function ScriptWizard({ ideaId }: { ideaId: string }) {
  const [step, setStep] = useState<Step>("angle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [angle, setAngle] = useState<string>("");
  const [hookMatches, setHookMatches] = useState<PatternMatch[]>([]);
  const [hookPatternId, setHookPatternId] = useState("");
  const [frameworkMatches, setFrameworkMatches] = useState<PatternMatch[]>([]);
  const [frameworkId, setFrameworkId] = useState("");
  const [reusedAnswers, setReusedAnswers] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);

  const [scriptId, setScriptId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [isSaving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);

  function fail(e: unknown) {
    setError(e instanceof Error ? e.message : "Something went wrong");
    setStep("error");
  }

  function chooseAngle() {
    if (!angle) return;
    setStep("matchingHooks");
    startTransition(async () => {
      try {
        const matches = await matchHookPatterns(ideaId, angle);
        setHookMatches(matches);
        setStep("hook");
      } catch (e) {
        fail(e);
      }
    });
  }

  function chooseHook() {
    if (!hookPatternId) return;
    setStep("matchingFrameworks");
    startTransition(async () => {
      try {
        const matches = await matchFrameworksForScript(ideaId, angle);
        setFrameworkMatches(matches);
        setStep("framework");
      } catch (e) {
        fail(e);
      }
    });
  }

  function chooseFramework() {
    if (!frameworkId) return;
    setStep("loadingQuestions");
    startTransition(async () => {
      try {
        const result = await getScriptQuestions(
          ideaId,
          angle,
          hookPatternId,
          frameworkId,
        );
        setQuestions(result.questions);
        setAnswers(result.answers);
        setReusedAnswers(result.reused);
        setStep("questions");
      } catch (e) {
        fail(e);
      }
    });
  }

  function writeScript() {
    setStep("generating");
    startTransition(async () => {
      try {
        const result = await generateScript({
          ideaId,
          angle,
          hookPatternId,
          frameworkId,
          answers: questions.map((question, i) => ({
            question,
            answer: answers[i] ?? "",
          })),
        });
        setScriptId(result.id);
        setContent(result.content);
        setStep("result");
      } catch (e) {
        fail(e);
      }
    });
  }

  function saveEdits() {
    if (!scriptId) return;
    startSaving(async () => {
      try {
        await updateScriptContent(scriptId, content);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function startOver() {
    setStep("angle");
    setError(null);
    setAngle("");
    setHookMatches([]);
    setHookPatternId("");
    setFrameworkMatches([]);
    setFrameworkId("");
    setReusedAnswers(false);
    setQuestions([]);
    setAnswers([]);
    setScriptId(null);
    setContent("");
    setSaved(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {step === "angle" && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="text-sm font-medium">Pick an angle</p>
            <RadioGroup value={angle} onValueChange={setAngle} className="gap-2">
              {ANGLES.map((a) => (
                <div key={a} className="flex items-center gap-2">
                  <RadioGroupItem value={a} id={`angle-${a}`} />
                  <Label htmlFor={`angle-${a}`} className="cursor-pointer font-normal">
                    {a}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <Button onClick={chooseAngle} disabled={!angle || isPending} className="self-start">
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {(step === "matchingHooks" || step === "matchingFrameworks" || step === "loadingQuestions" || step === "generating") && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {step === "matchingHooks" && "Finding the best-fit hooks..."}
          {step === "matchingFrameworks" && "Finding the best-fit frameworks..."}
          {step === "loadingQuestions" && "Preparing follow-up questions..."}
          {step === "generating" && "Writing the script..."}
        </p>
      )}

      {step === "hook" && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="text-sm font-medium">Pick a hook structure</p>
            <RadioGroup value={hookPatternId} onValueChange={setHookPatternId} className="gap-3">
              {hookMatches.map((m) => (
                <div key={m.id} className="flex items-start gap-3 rounded-md border p-3">
                  <RadioGroupItem value={m.id} id={m.id} className="mt-1" />
                  <Label htmlFor={m.id} className="flex-1 cursor-pointer">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-sm font-normal text-muted-foreground">{m.reason}</div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <Button onClick={chooseHook} disabled={!hookPatternId || isPending} className="self-start">
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "framework" && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="text-sm font-medium">Pick a framework</p>
            <RadioGroup value={frameworkId} onValueChange={setFrameworkId} className="gap-3">
              {frameworkMatches.map((m) => (
                <div key={m.id} className="flex items-start gap-3 rounded-md border p-3">
                  <RadioGroupItem value={m.id} id={m.id} className="mt-1" />
                  <Label htmlFor={m.id} className="flex-1 cursor-pointer">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-sm font-normal text-muted-foreground">{m.reason}</div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <Button onClick={chooseFramework} disabled={!frameworkId || isPending} className="self-start">
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "questions" && (
        <Card>
          <CardContent className="flex flex-col gap-4 p-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Answer a few questions</p>
              {reusedAnswers && (
                <Badge variant="secondary" className="text-[10px]">
                  From your Idea flesh-out
                </Badge>
              )}
            </div>
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
            <Button onClick={writeScript} disabled={isPending} className="self-start">
              Write script
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "result" && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="text-sm font-medium">Script</p>
            <Textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setSaved(false);
              }}
              className="min-h-64"
            />
            <div className="flex items-center gap-3">
              <Button onClick={saveEdits} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save edits"}
              </Button>
              <Button variant="outline" onClick={startOver}>
                Start a new script
              </Button>
              {saved && !isSaving && (
                <span className="text-sm text-muted-foreground">Saved.</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === "error" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={startOver} className="self-start">
            Start over
          </Button>
        </div>
      )}
    </div>
  );
}
