"use client";

import { useState, useTransition } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  saveScriptProcessSettings,
  type ScriptProcessSettings,
} from "../process-actions";

function Step({
  number,
  title,
  description,
  id,
  value,
  onChange,
}: {
  number: number;
  title: string;
  description: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            Step {number}
          </Badge>
          <p className="text-sm font-medium">{title}</p>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        <Label htmlFor={id} className="sr-only">
          {title}
        </Label>
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-28"
        />
      </CardContent>
    </Card>
  );
}

export function ProcessForm({
  initial,
}: {
  initial: ScriptProcessSettings;
}) {
  const [fields, setFields] = useState(initial);
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof ScriptProcessSettings>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    startSaving(async () => {
      try {
        await saveScriptProcessSettings(fields);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Step
        number={1}
        title="Recommend an angle"
        description="You pick which idea to work from. AI recommends 2-3 angles (contrarian, personal story, etc.) ordered best fit first, with the top one framed as a confident suggestion — you choose one."
        id="angle-instructions"
        value={fields.angleInstructions}
        onChange={(v) => set("angleInstructions", v)}
      />
      <Step
        number={2}
        title="Recommend a framework"
        description="AI compares the idea and chosen angle against your Framework Library and recommends 2-3 frameworks, best fit first — you choose one."
        id="framework-instructions"
        value={fields.frameworkInstructions}
        onChange={(v) => set("frameworkInstructions", v)}
      />
      <Step
        number={3}
        title="Ask follow-up questions"
        description="Once an angle and framework are chosen, AI asks a few short questions to gather the actual substance for this specific script."
        id="questions-instructions"
        value={fields.questionsInstructions}
        onChange={(v) => set("questionsInstructions", v)}
      />
      <Step
        number={4}
        title="Write the draft"
        description="AI writes the full script draft from your idea, angle, framework, answers, and Brand Profile — with a strong but generic opening. The hook structure is chosen next, after this draft exists."
        id="script-instructions"
        value={fields.scriptInstructions}
        onChange={(v) => set("scriptInstructions", v)}
      />
      <Step
        number={5}
        title="Recommend a hook, using the draft"
        description="Last step, on purpose — the hook matters too much to pick blind. AI reads the actual draft and recommends 2-3 hook structures that fit what got written, best fit first. You choose one, and only the opening gets rewritten to match it."
        id="hook-instructions"
        value={fields.hookInstructions}
        onChange={(v) => set("hookInstructions", v)}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button disabled={isSaving} onClick={handleSave}>
          {isSaving ? "Saving..." : "Save instructions"}
        </Button>
        {saved && !isSaving && (
          <span className="text-sm text-muted-foreground">Saved.</span>
        )}
      </div>
    </div>
  );
}
