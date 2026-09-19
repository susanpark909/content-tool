"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  recommendAngle,
  matchFrameworksForScript,
  getScriptQuestions,
  generateDraftScript,
  recommendHooksForDraft,
  finalizeScriptHook,
  updateScriptContent,
  type PatternMatch,
} from "../actions";

type Step =
  | "matchingAngle"
  | "angle"
  | "matchingFrameworks"
  | "framework"
  | "loadingQuestions"
  | "questions"
  | "generatingDraft"
  | "matchingHooks"
  | "hook"
  | "finalizingHook"
  | "result"
  | "error";

function RecommendCard({
  title,
  matches,
  value,
  onChange,
  onContinue,
  continueLabel = "Continue",
  disabled,
}: {
  title: string;
  matches: PatternMatch[];
  value: string;
  onChange: (value: string) => void;
  onContinue: () => void;
  continueLabel?: string;
  disabled: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="text-sm font-medium">{title}</p>
        <RadioGroup value={value} onValueChange={onChange} className="gap-3">
          {matches.map((m, i) => (
            <div key={m.id} className="flex items-start gap-3 rounded-md border p-3">
              <RadioGroupItem value={m.id} id={m.id} className="mt-1" />
              <Label htmlFor={m.id} className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.name}</span>
                  {i === 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      Recommended
                    </Badge>
                  )}
                </div>
                <div className="text-sm font-normal text-muted-foreground">{m.reason}</div>
              </Label>
            </div>
          ))}
        </RadioGroup>
        <Button onClick={onContinue} disabled={!value || disabled} className="self-start">
          {continueLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ScriptWizard({ ideaId }: { ideaId: string }) {
  const [step, setStep] = useState<Step>("matchingAngle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [angleMatches, setAngleMatches] = useState<PatternMatch[]>([]);
  const [angle, setAngle] = useState("");
  const [frameworkMatches, setFrameworkMatches] = useState<PatternMatch[]>([]);
  const [frameworkId, setFrameworkId] = useState("");
  const [reusedAnswers, setReusedAnswers] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [hookMatches, setHookMatches] = useState<PatternMatch[]>([]);
  const [hookPatternId, setHookPatternId] = useState("");

  const [scriptId, setScriptId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [isSaving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);

  function fail(e: unknown) {
    setError(e instanceof Error ? e.message : "Something went wrong");
    setStep("error");
  }

  function loadAngles() {
    setStep("matchingAngle");
    startTransition(async () => {
      try {
        const matches = await recommendAngle(ideaId);
        setAngleMatches(matches);
        setAngle(matches[0]?.id ?? "");
        setStep("angle");
      } catch (e) {
        fail(e);
      }
    });
  }

  useEffect(() => {
    loadAngles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideaId]);

  function chooseAngle() {
    if (!angle) return;
    setStep("matchingFrameworks");
    startTransition(async () => {
      try {
        const matches = await matchFrameworksForScript(ideaId, angle);
        setFrameworkMatches(matches);
        setFrameworkId(matches[0]?.id ?? "");
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
        const result = await getScriptQuestions(ideaId, angle, frameworkId);
        setQuestions(result.questions);
        setAnswers(result.answers);
        setReusedAnswers(result.reused);
        setStep("questions");
      } catch (e) {
        fail(e);
      }
    });
  }

  function writeDraft() {
    setStep("generatingDraft");
    startTransition(async () => {
      try {
        const draft = await generateDraftScript({
          ideaId,
          angle,
          frameworkId,
          answers: questions.map((question, i) => ({
            question,
            answer: answers[i] ?? "",
          })),
        });
        setScriptId(draft.id);
        setContent(draft.content);
        setStep("matchingHooks");
        const hooks = await recommendHooksForDraft(draft.id);
        setHookMatches(hooks);
        setHookPatternId(hooks[0]?.id ?? "");
        setStep("hook");
      } catch (e) {
        fail(e);
      }
    });
  }

  function chooseHook() {
    if (!hookPatternId || !scriptId) return;
    setStep("finalizingHook");
    startTransition(async () => {
      try {
        const result = await finalizeScriptHook(scriptId, hookPatternId);
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
    setError(null);
    setAngleMatches([]);
    setAngle("");
    setFrameworkMatches([]);
    setFrameworkId("");
    setReusedAnswers(false);
    setQuestions([]);
    setAnswers([]);
    setHookMatches([]);
    setHookPatternId("");
    setScriptId(null);
    setContent("");
    setSaved(false);
    loadAngles();
  }

  return (
    <div className="flex flex-col gap-4">
      {(step === "matchingAngle" || step === "matchingFrameworks" || step === "loadingQuestions" || step === "generatingDraft" || step === "matchingHooks" || step === "finalizingHook") && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {step === "matchingAngle" && "Thinking about the best angle..."}
          {step === "matchingFrameworks" && "Finding the best-fit frameworks..."}
          {step === "loadingQuestions" && "Preparing follow-up questions..."}
          {step === "generatingDraft" && "Writing the draft..."}
          {step === "matchingHooks" && "Reading the draft to recommend a hook..."}
          {step === "finalizingHook" && "Rewriting the opening..."}
        </p>
      )}

      {step === "angle" && (
        <RecommendCard
          title="Pick an angle"
          matches={angleMatches}
          value={angle}
          onChange={setAngle}
          onContinue={chooseAngle}
          disabled={isPending}
        />
      )}

      {step === "framework" && (
        <RecommendCard
          title="Pick a framework"
          matches={frameworkMatches}
          value={frameworkId}
          onChange={setFrameworkId}
          onContinue={chooseFramework}
          disabled={isPending}
        />
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
            <Button onClick={writeDraft} disabled={isPending} className="self-start">
              Write draft
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "hook" && (
        <RecommendCard
          title="Pick a hook — based on what actually got written"
          matches={hookMatches}
          value={hookPatternId}
          onChange={setHookPatternId}
          onContinue={chooseHook}
          continueLabel="Use this hook"
          disabled={isPending}
        />
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
