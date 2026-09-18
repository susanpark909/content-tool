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
        title="Recommend a hook"
        description="You pick which idea to work from and its angle. AI compares it against your Hook Library and recommends 2-3 hook structures — you choose one."
        id="hook-instructions"
        value={fields.hookInstructions}
        onChange={(v) => set("hookInstructions", v)}
      />
      <Step
        number={2}
        title="Recommend a framework"
        description="AI compares the idea against your Framework Library and recommends 2-3 frameworks with a reason each — you choose one."
        id="framework-instructions"
        value={fields.frameworkInstructions}
        onChange={(v) => set("frameworkInstructions", v)}
      />
      <Step
        number={3}
        title="Ask follow-up questions"
        description="Once a hook and framework are chosen, AI asks a few short questions to gather the actual substance for this specific script."
        id="questions-instructions"
        value={fields.questionsInstructions}
        onChange={(v) => set("questionsInstructions", v)}
      />
      <Step
        number={4}
        title="Write the script"
        description="AI writes the full script from your idea, angle, hook, framework, answers, and your Brand Profile. This is the step that determines how the final draft actually sounds."
        id="script-instructions"
        value={fields.scriptInstructions}
        onChange={(v) => set("scriptInstructions", v)}
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
