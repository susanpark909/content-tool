"use client";

import { useRef, useState, useTransition } from "react";
import { XIcon } from "lucide-react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { createJournalEntry } from "./actions";
import { uploadJournalAttachment, type UploadedAttachment } from "@/lib/journal-upload";

function isImageType(type: string) {
  return type.startsWith("image/");
}

export function JournalForm({
  onCreated,
}: {
  onCreated: (entry: {
    id: string;
    createdAt: string;
    text: string;
    attachments: UploadedAttachment[];
  }) => void;
}) {
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
        const result = await createJournalEntry(content, attachments);
        if (result) {
          onCreated({
            id: result.id,
            createdAt: result.createdAt,
            text: content.trim(),
            attachments,
          });
        }
        setContent("");
        setAttachments([]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const busy = isSaving || isUploading;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[#F0F0F1] bg-white px-6 pt-5.5 pb-4.5 shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onPaste={handlePaste}
        disabled={isSaving}
        rows={4}
        placeholder="What's on your mind?"
        className="field-sizing-content min-h-[116px] resize-none border-0 bg-transparent p-0 text-xl font-medium text-[#0D0D0D] outline-none placeholder:text-[#0D0D0D]/50"
      />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <div
              key={a.url}
              className="relative flex items-center gap-2 rounded-[4px] bg-[#E9E9E7] py-1 pr-2.5 pl-1 text-xs font-semibold"
            >
              <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                {isImageType(a.type) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.url}
                    alt=""
                    className="size-8 rounded-[3px] object-cover"
                  />
                ) : (
                  <span className="flex size-8 items-center justify-center rounded-[3px] bg-[#FF1F8F] text-[9px] font-black">
                    {(a.name.split(".").pop() || "").toUpperCase().slice(0, 4)}
                  </span>
                )}
                <span className="max-w-32 truncate">{a.name}</span>
              </a>
              <button
                onClick={() => removeAttachment(i)}
                className="text-[#4a4a48] hover:text-[#0D0D0D]"
                aria-label="Remove attachment"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 rounded-[4px] border border-[#CFCFCD] bg-[#F6F6F5] px-3.5 py-2 text-[13px] font-semibold hover:border-[#0D0D0D]">
          + Attach image or file
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
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={handleSave}
          className="flex items-center gap-2 rounded-[4px] bg-[#FF1F8F] py-2.5 pr-5 pl-4 text-sm font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60"
        >
          <MaterialIcon name="bolt" size={18} weight={500} />
          {isSaving ? "Saving..." : isUploading ? "Uploading..." : "Save idea"}
        </button>
      </div>
    </div>
  );
}
