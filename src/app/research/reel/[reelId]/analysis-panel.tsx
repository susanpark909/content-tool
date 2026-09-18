"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  analyzeReel,
  addHookPattern,
  addFramework,
  saveHook,
  saveFrameworkExample,
  type ReelAnalysis,
} from "./analysis-actions";

type LibraryOption = { id: string; name: string };

export function AnalysisPanel({
  reelId,
  hookPatterns,
  frameworks,
  savedHook,
  savedFrameworkExample,
}: {
  reelId: string;
  hookPatterns: LibraryOption[];
  frameworks: LibraryOption[];
  savedHook: {
    hookText: string;
    patternId: string | null;
    emotionalMechanism: string | null;
    ctaUsed: string | null;
    whyItWorked: string | null;
  } | null;
  savedFrameworkExample: { frameworkId: string; note: string | null } | null;
}) {
  const [patterns, setPatterns] = useState(hookPatterns);
  const [frameworkOptions, setFrameworkOptions] = useState(frameworks);
  const [analysis, setAnalysis] = useState<ReelAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, startAnalyzing] = useTransition();

  const [hookText, setHookText] = useState(savedHook?.hookText ?? "");
  const [hookPatternId, setHookPatternId] = useState<string>(
    savedHook?.patternId ?? "none",
  );
  const [emotionalMechanism, setEmotionalMechanism] = useState(
    savedHook?.emotionalMechanism ?? "",
  );
  const [ctaUsed, setCtaUsed] = useState(savedHook?.ctaUsed ?? "");
  const [whyItWorked, setWhyItWorked] = useState(savedHook?.whyItWorked ?? "");
  const [hookSaved, setHookSaved] = useState(Boolean(savedHook));
  const [isSavingHook, startSavingHook] = useTransition();

  const [frameworkId, setFrameworkId] = useState<string>(
    savedFrameworkExample?.frameworkId ?? "none",
  );
  const [frameworkNote, setFrameworkNote] = useState(
    savedFrameworkExample?.note ?? "",
  );
  const [frameworkSaved, setFrameworkSaved] = useState(
    Boolean(savedFrameworkExample),
  );
  const [isSavingFramework, startSavingFramework] = useTransition();

  const [newPatternPending, setNewPatternPending] = useState<string | null>(
    null,
  );
  const [newFrameworkPending, setNewFrameworkPending] = useState<
    string | null
  >(null);
  const [isAddingPattern, startAddingPattern] = useTransition();
  const [isAddingFramework, startAddingFramework] = useTransition();

  function handleAnalyze() {
    setError(null);
    startAnalyzing(async () => {
      try {
        const result = await analyzeReel(reelId);
        setAnalysis(result);
        setHookText(result.hookText);
        setHookPatternId(result.hookPatternId ?? "none");
        setEmotionalMechanism(result.emotionalMechanism);
        setCtaUsed(result.ctaUsed ?? "");
        setWhyItWorked(result.whyItWorked);
        setNewPatternPending(result.suggestedNewHookPattern);

        setFrameworkId(result.frameworkId ?? "none");
        setFrameworkNote(result.frameworkMatchNote ?? "");
        setNewFrameworkPending(result.suggestedNewFramework);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleAddPattern() {
    if (!newPatternPending) return;
    startAddingPattern(async () => {
      try {
        const created = await addHookPattern(newPatternPending);
        setPatterns((prev) => [...prev, created]);
        setHookPatternId(created.id);
        setNewPatternPending(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleAddFramework() {
    if (!newFrameworkPending) return;
    startAddingFramework(async () => {
      try {
        const created = await addFramework(newFrameworkPending);
        setFrameworkOptions((prev) => [...prev, created]);
        setFrameworkId(created.id);
        setNewFrameworkPending(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleSaveHook() {
    setError(null);
    startSavingHook(async () => {
      try {
        await saveHook(reelId, {
          hookText,
          patternId: hookPatternId === "none" ? null : hookPatternId,
          emotionalMechanism,
          ctaUsed: ctaUsed.trim() || null,
          whyItWorked,
        });
        setHookSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function handleSaveFramework() {
    if (frameworkId === "none") {
      setError("Pick a framework before saving");
      return;
    }
    setError(null);
    startSavingFramework(async () => {
      try {
        await saveFrameworkExample(reelId, frameworkId, frameworkNote || null);
        setFrameworkSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const showForm = analysis || savedHook || savedFrameworkExample;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Hook &amp; framework analysis</p>
          <Link href="/hooks" className="text-xs text-muted-foreground hover:underline">
            Hook Library
          </Link>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!showForm && (
          <>
            <p className="text-sm text-muted-foreground">
              Extract this reel&apos;s opening hook and overall framework to
              save into your libraries.
            </p>
            <Button
              variant="outline"
              disabled={isAnalyzing}
              onClick={handleAnalyze}
            >
              {isAnalyzing ? "Analyzing..." : "Analyze for hook & framework"}
            </Button>
          </>
        )}

        {showForm && (
          <div className="flex flex-col gap-6">
            {/* Hook */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Hook</p>
                {hookSaved && <Badge variant="secondary">Saved</Badge>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hook-text">Hook text</Label>
                <Textarea
                  id="hook-text"
                  value={hookText}
                  onChange={(e) => setHookText(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Pattern</Label>
                <Select
                  value={hookPatternId}
                  onValueChange={(value) => setHookPatternId(value ?? "none")}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value: string) =>
                        value === "none"
                          ? "No pattern"
                          : (patterns.find((p) => p.id === value)?.name ??
                            "No pattern")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No pattern</SelectItem>
                    {patterns.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {newPatternPending && (
                <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
                  <p className="text-sm text-muted-foreground">
                    No existing pattern matched well. The AI suggests a new
                    pattern: <span className="font-medium">&quot;{newPatternPending}&quot;</span>
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isAddingPattern}
                    onClick={handleAddPattern}
                    className="self-start"
                  >
                    {isAddingPattern
                      ? "Adding..."
                      : `Add "${newPatternPending}" to the library`}
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="emotional-mechanism">
                    Emotional mechanism
                  </Label>
                  <Input
                    id="emotional-mechanism"
                    value={emotionalMechanism}
                    onChange={(e) => setEmotionalMechanism(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cta-used">CTA used</Label>
                  <Input
                    id="cta-used"
                    value={ctaUsed}
                    onChange={(e) => setCtaUsed(e.target.value)}
                    placeholder="—"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="why-it-worked">Why it worked</Label>
                <Textarea
                  id="why-it-worked"
                  value={whyItWorked}
                  onChange={(e) => setWhyItWorked(e.target.value)}
                />
              </div>

              <Button
                size="sm"
                disabled={isSavingHook || !hookText.trim()}
                onClick={handleSaveHook}
                className="self-start"
              >
                {isSavingHook
                  ? "Saving..."
                  : hookSaved
                    ? "Update Hook Library entry"
                    : "Save to Hook Library"}
              </Button>
            </div>

            {/* Framework */}
            <div className="flex flex-col gap-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Framework</p>
                <div className="flex items-center gap-2">
                  {frameworkSaved && <Badge variant="secondary">Saved</Badge>}
                  <Link
                    href="/frameworks"
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Framework Library
                  </Link>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Matched framework</Label>
                <Select
                  value={frameworkId}
                  onValueChange={(value) => setFrameworkId(value ?? "none")}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(value: string) =>
                        value === "none"
                          ? "No framework"
                          : (frameworkOptions.find((f) => f.id === value)
                              ?.name ?? "No framework")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No framework</SelectItem>
                    {frameworkOptions.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {newFrameworkPending && (
                <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
                  <p className="text-sm text-muted-foreground">
                    No existing framework matched well. The AI suggests a new
                    framework: <span className="font-medium">&quot;{newFrameworkPending}&quot;</span>
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isAddingFramework}
                    onClick={handleAddFramework}
                    className="self-start"
                  >
                    {isAddingFramework
                      ? "Adding..."
                      : `Add "${newFrameworkPending}" to the library`}
                  </Button>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="framework-note">Why this framework fits</Label>
                <Textarea
                  id="framework-note"
                  value={frameworkNote}
                  onChange={(e) => setFrameworkNote(e.target.value)}
                />
              </div>

              <Button
                size="sm"
                disabled={isSavingFramework || frameworkId === "none"}
                onClick={handleSaveFramework}
                className="self-start"
              >
                {isSavingFramework
                  ? "Saving..."
                  : frameworkSaved
                    ? "Update framework example"
                    : "Save framework example"}
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              disabled={isAnalyzing}
              onClick={handleAnalyze}
              className="self-start text-muted-foreground"
            >
              {isAnalyzing ? "Re-analyzing..." : "Re-analyze"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
