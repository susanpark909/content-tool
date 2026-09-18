"use client";

import { useState, useTransition } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { saveBrandProfile, type BrandProfileFields } from "./actions";

function Field({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function BrandProfileForm({ initial }: { initial: BrandProfileFields }) {
  const [fields, setFields] = useState(initial);
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof BrandProfileFields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    startSaving(async () => {
      try {
        await saveBrandProfile(fields);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <p className="text-sm font-medium">Voice &amp; audience</p>
          <Field
            id="voice-tone"
            label="Voice / tone"
            hint="How you sound — casual, blunt, warm, dry, etc."
            value={fields.voiceTone}
            onChange={(v) => set("voiceTone", v)}
          />
          <Field
            id="phrases-to-use"
            label="Phrases to use"
            hint="Words or phrases you naturally reach for"
            value={fields.phrasesToUse}
            onChange={(v) => set("phrasesToUse", v)}
          />
          <Field
            id="phrases-to-avoid"
            label="Phrases to avoid"
            hint="Words or phrases that don't sound like you"
            value={fields.phrasesToAvoid}
            onChange={(v) => set("phrasesToAvoid", v)}
          />
          <Field
            id="audience"
            label="Audience"
            hint="Who you're actually talking to"
            value={fields.audience}
            onChange={(v) => set("audience", v)}
          />
          <Field
            id="content-pillars"
            label="Content pillars / topics"
            value={fields.contentPillars}
            onChange={(v) => set("contentPillars", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <p className="text-sm font-medium">Stories &amp; opinions</p>
          <Field
            id="personal-stories"
            label="Personal stories / experiences"
            hint="Real things that happened to you, worth referencing"
            value={fields.personalStories}
            onChange={(v) => set("personalStories", v)}
          />
          <Field
            id="opinions-povs"
            label="Opinions / POVs"
            value={fields.opinionsPovs}
            onChange={(v) => set("opinionsPovs", v)}
          />
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Strong opinion / wedge</p>
            <Badge variant="secondary">Highest-value field</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            A specific contrarian belief you hold that most people in your
            space would push back on. This is the single best source for
            polarizing, high-engagement hooks.
          </p>
          <Textarea
            id="strong-opinion-wedge"
            value={fields.strongOpinionWedge}
            onChange={(e) => set("strongOpinionWedge", e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <p className="text-sm font-medium">Offers &amp; examples</p>
          <Field
            id="offers-products"
            label="Offers / products"
            hint="When relevant to mention in content"
            value={fields.offersProducts}
            onChange={(v) => set("offersProducts", v)}
          />
          <Field
            id="examples-like-susan"
            label="Examples of content that feels most like you"
            value={fields.examplesLikeSusan}
            onChange={(v) => set("examplesLikeSusan", v)}
          />
          <Field
            id="examples-hates"
            label="Examples of content/style you hate"
            value={fields.examplesHates}
            onChange={(v) => set("examplesHates", v)}
          />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button disabled={isSaving} onClick={handleSave}>
          {isSaving ? "Saving..." : "Save Brand Profile"}
        </Button>
        {saved && !isSaving && (
          <span className="text-sm text-muted-foreground">Saved.</span>
        )}
      </div>
    </div>
  );
}
