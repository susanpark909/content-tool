"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  recommendAngle,
  matchFrameworksForScript,
  getScriptQuestions,
  generateDraftScript,
  recommendHooksForDraft,
  finalizeScriptHook,
  updateScriptContent,
  gradeScript,
  reviseScriptForFixes,
  type PatternMatch,
  type ScriptGrade,
} from "../actions";
import { GRADE_PASS_BAR, MAX_AUTO_REVISIONS } from "../constants";

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

function scoreColor(score: number) {
  if (score >= GRADE_PASS_BAR) return "text-primary";
  if (score >= GRADE_PASS_BAR - 2) return "text-muted-foreground";
  return "text-destructive";
}

function GradeCard({
  grade,
  gradingPhase,
  revisionAttempt,
  gradingError,
  onRegrade,
  isBusy,
}: {
  grade: ScriptGrade | null;
  gradingPhase: "idle" | "grading" | "revising" | "done";
  revisionAttempt: number;
  gradingError: string | null;
  onRegrade: () => void;
  isBusy: boolean;
}) {
  return (
    <Card className={cn(grade && grade.overallScore >= GRADE_PASS_BAR ? "border-primary/40" : "border-destructive/30")}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Post Grader</p>
          {grade && (
            <span className={cn("text-lg font-semibold", scoreColor(grade.overallScore))}>
              {grade.overallScore.toFixed(1)}/10
            </span>
          )}
        </div>

        {(gradingPhase === "grading" || gradingPhase === "revising") && (
          <p className="text-sm text-muted-foreground">
            {gradingPhase === "grading"
              ? "Grading..."
              : `Below ${GRADE_PASS_BAR}/10 — revising and re-checking (attempt ${revisionAttempt}/${MAX_AUTO_REVISIONS})...`}
          </p>
        )}

        {gradingError && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-destructive">{gradingError}</p>
            <Button size="sm" variant="outline" onClick={onRegrade} disabled={isBusy} className="self-start">
              Try grading again
            </Button>
          </div>
        )}

        {grade && gradingPhase === "done" && (
          <>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {grade.dimensions.map((d) => (
                <div key={d.name} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className={cn("font-medium", scoreColor(d.score))}>{d.score.toFixed(0)}/10</span>
                </div>
              ))}
            </div>

            {grade.voiceRuleViolations.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground">Voice rule violations</p>
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  {grade.voiceRuleViolations.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">
                {grade.overallScore >= GRADE_PASS_BAR ? "Top fixes (optional)" : "Top fixes"}
              </p>
              <ol className="list-inside list-decimal text-sm">
                {grade.topFixes.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ol>
            </div>

            <Button size="sm" variant="outline" onClick={onRegrade} disabled={isBusy} className="self-start">
              Re-grade
            </Button>
          </>
        )}
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

  const [grade, setGrade] = useState<ScriptGrade | null>(null);
  const [gradingPhase, setGradingPhase] = useState<"idle" | "grading" | "revising" | "done">("idle");
  const [revisionAttempt, setRevisionAttempt] = useState(0);
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [isGrading, startGrading] = useTransition();

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

  function runGradingLoop(id: string) {
    setGradingError(null);
    setGrade(null);
    setRevisionAttempt(0);
    setGradingPhase("grading");
    startGrading(async () => {
      try {
        let attempt = 0;
        let g = await gradeScript(id);
        setGrade(g);
        while (g.overallScore < GRADE_PASS_BAR && attempt < MAX_AUTO_REVISIONS) {
          attempt++;
          setRevisionAttempt(attempt);
          setGradingPhase("revising");
          const revised = await reviseScriptForFixes(id, g.topFixes, g.voiceRuleViolations);
          setContent(revised.content);
          setGradingPhase("grading");
          g = await gradeScript(id);
          setGrade(g);
        }
        setGradingPhase("done");
      } catch (e) {
        setGradingError(e instanceof Error ? e.message : "Grading failed");
        setGradingPhase("done");
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
        runGradingLoop(scriptId);
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
        setGrade(null);
        setGradingPhase("idle");
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function regrade() {
    if (!scriptId) return;
    runGradingLoop(scriptId);
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
    setGrade(null);
    setGradingPhase("idle");
    setGradingError(null);
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
        <>
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

          {gradingPhase !== "idle" && (
            <GradeCard
              grade={grade}
              gradingPhase={gradingPhase}
              revisionAttempt={revisionAttempt}
              gradingError={gradingError}
              onRegrade={regrade}
              isBusy={isGrading}
            />
          )}
        </>
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
