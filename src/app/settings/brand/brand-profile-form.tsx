"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MicIcon, PaperclipIcon, SquareIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  saveBrandProfile,
  updateBrandProfileFromText,
  type BrandProfileFields,
} from "./actions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionCtor = new () => any;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  highlighted,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  highlighted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        {highlighted && (
          <Badge variant="secondary" className="text-[10px]">
            Updated
          </Badge>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(highlighted && "border-primary/50 bg-primary/5")}
      />
    </div>
  );
}

export function BrandProfileForm({ initial }: { initial: BrandProfileFields }) {
  const [fields, setFields] = useState(initial);
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Capture / organize
  const [dumpText, setDumpText] = useState("");
  const [isOrganizing, startOrganizing] = useTransition();
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognition()));
  }, []);

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

  function handleOrganize() {
    if (!dumpText.trim()) return;
    setError(null);
    startOrganizing(async () => {
      try {
        const updated = await updateBrandProfileFromText(dumpText);
        const changed = new Set<string>();
        for (const key of Object.keys(updated) as (keyof BrandProfileFields)[]) {
          if (updated[key] !== fields[key]) changed.add(key);
        }
        setFields(updated);
        setChangedKeys(changed);
        setDumpText("");
        setSaved(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function toggleRecording() {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setDumpText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setDumpText((prev) => (prev ? `${prev}\n\n${text}` : text));
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-primary/30">
        <CardContent className="flex flex-col gap-3 p-4">
          <div>
            <p className="text-sm font-medium">Tell me about your brand</p>
            <p className="text-xs text-muted-foreground">
              Type, paste, upload a file, or speak — anything about your
              voice, audience, opinions, past content. AI sorts it into the
              right fields below and merges it with what&apos;s already there.
            </p>
          </div>

          <Textarea
            value={dumpText}
            onChange={(e) => setDumpText(e.target.value)}
            placeholder="e.g. 'I always tell people that most productivity advice is a scam...' or paste an old bio, notes, anything."
            className="min-h-28"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={!dumpText.trim() || isOrganizing}
              onClick={handleOrganize}
            >
              {isOrganizing ? "Organizing..." : "Update Brand Profile"}
            </Button>

            {speechSupported && (
              <Button
                size="sm"
                variant="outline"
                onClick={toggleRecording}
                aria-label={isRecording ? "Stop recording" : "Speak"}
              >
                {isRecording ? (
                  <>
                    <SquareIcon className="text-destructive" /> Stop
                  </>
                ) : (
                  <>
                    <MicIcon /> Speak
                  </>
                )}
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <PaperclipIcon /> Upload file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <p className="text-sm font-medium">Voice &amp; audience</p>
          <Field
            id="voice-tone"
            label="Voice / tone"
            hint="How you sound — casual, blunt, warm, dry, etc."
            value={fields.voiceTone}
            onChange={(v) => set("voiceTone", v)}
            highlighted={changedKeys.has("voiceTone")}
          />
          <Field
            id="phrases-to-use"
            label="Phrases to use"
            hint="Words or phrases you naturally reach for"
            value={fields.phrasesToUse}
            onChange={(v) => set("phrasesToUse", v)}
            highlighted={changedKeys.has("phrasesToUse")}
          />
          <Field
            id="phrases-to-avoid"
            label="Phrases to avoid"
            hint="Words or phrases that don't sound like you"
            value={fields.phrasesToAvoid}
            onChange={(v) => set("phrasesToAvoid", v)}
            highlighted={changedKeys.has("phrasesToAvoid")}
          />
          <Field
            id="audience"
            label="Audience"
            hint="Who you're actually talking to"
            value={fields.audience}
            onChange={(v) => set("audience", v)}
            highlighted={changedKeys.has("audience")}
          />
          <Field
            id="content-pillars"
            label="Content pillars / topics"
            value={fields.contentPillars}
            onChange={(v) => set("contentPillars", v)}
            highlighted={changedKeys.has("contentPillars")}
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
            highlighted={changedKeys.has("personalStories")}
          />
          <Field
            id="opinions-povs"
            label="Opinions / POVs"
            value={fields.opinionsPovs}
            onChange={(v) => set("opinionsPovs", v)}
            highlighted={changedKeys.has("opinionsPovs")}
          />
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Strong opinion / wedge</p>
            <Badge variant="secondary">Highest-value field</Badge>
            {changedKeys.has("strongOpinionWedge") && (
              <Badge variant="secondary" className="text-[10px]">
                Updated
              </Badge>
            )}
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
            className={cn(
              changedKeys.has("strongOpinionWedge") && "border-primary/50 bg-primary/5",
            )}
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
            highlighted={changedKeys.has("offersProducts")}
          />
          <Field
            id="examples-like-susan"
            label="Examples of content that feels most like you"
            value={fields.examplesLikeSusan}
            onChange={(v) => set("examplesLikeSusan", v)}
            highlighted={changedKeys.has("examplesLikeSusan")}
          />
          <Field
            id="examples-hates"
            label="Examples of content/style you hate"
            value={fields.examplesHates}
            onChange={(v) => set("examplesHates", v)}
            highlighted={changedKeys.has("examplesHates")}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button disabled={isSaving} onClick={handleSave} variant="outline">
          {isSaving ? "Saving..." : "Save manual edits"}
        </Button>
        {saved && !isSaving && (
          <span className="text-sm text-muted-foreground">Saved.</span>
        )}
      </div>
    </div>
  );
}
