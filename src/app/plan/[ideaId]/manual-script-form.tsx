"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createManualScript } from "../script-actions";

export function ManualScriptForm({ ideaId }: { ideaId: string }) {
  const [content, setContent] = useState("");
  const [isSaving, startSaving] = useTransition();

  function handleSave() {
    if (!content.trim()) return;
    startSaving(async () => {
      await createManualScript(ideaId, content);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste or write the script here."
        className="min-h-40 text-sm"
      />
      <Button size="sm" onClick={handleSave} disabled={isSaving || !content.trim()} className="self-start">
        {isSaving ? "Saving..." : "Save script"}
      </Button>
    </div>
  );
}
