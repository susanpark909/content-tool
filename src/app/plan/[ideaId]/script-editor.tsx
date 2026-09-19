"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateScriptContent } from "@/app/create/actions";

export function ScriptEditor({
  scriptId,
  initialContent,
}: {
  scriptId: string;
  initialContent: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(false);
    startSaving(async () => {
      await updateScriptContent(scriptId, content);
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setSaved(false);
        }}
        className="min-h-64 text-sm"
      />
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={handleSave} disabled={isSaving || content === initialContent}>
          {isSaving ? "Saving..." : "Save changes"}
        </Button>
        {saved && !isSaving && <span className="text-sm text-muted-foreground">Saved.</span>}
      </div>
    </div>
  );
}
