"use client";

import { useRef, useState, useTransition } from "react";
import { PaperclipIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createJournalEntry } from "./actions";
import { uploadJournalAttachment, type UploadedAttachment } from "@/lib/journal-upload";

function isImageType(type: string) {
  return type.startsWith("image/");
}

export function JournalForm() {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | File[]) {
    setError(null);
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadJournalAttachment(file);
        setAttachments((prev) => [...prev, uploaded]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f != null);
    if (files.length > 0) {
      addFiles(files);
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    if (!content.trim() && attachments.length === 0) return;
    setError(null);
    startSaving(async () => {
      try {
        await createJournalEntry(content, attachments);
        setContent("");
        setAttachments([]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const busy = isSaving || isUploading;

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onPaste={handlePaste}
        placeholder="What's the idea? (you can paste an image here too)"
        rows={6}
        disabled={isSaving}
      />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <div
              key={a.url}
              className="relative flex items-center gap-1.5 rounded-md border p-1 pr-2 text-xs"
            >
              {isImageType(a.type) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt="" className="h-10 w-10 rounded object-cover" />
              ) : (
                <PaperclipIcon className="size-4 text-muted-foreground" />
              )}
              <span className="max-w-32 truncate">{a.name}</span>
              <button
                onClick={() => removeAttachment(i)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove attachment"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button disabled={busy} onClick={handleSave} className="self-start">
          {isSaving ? "Saving..." : "Save entry"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          <PaperclipIcon /> {isUploading ? "Uploading..." : "Attach"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.md"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
