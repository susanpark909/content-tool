"use client";

import { useRef, useState, useTransition } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { uploadJournalAttachment } from "@/lib/journal-upload";
import { addAttachmentsToEntry, removeAttachment } from "@/app/idea/actions";

export type IdeaAttachment = { id: string; fileUrl: string; fileType: string | null; fileName: string | null };

// The files attached to an idea (photos, documents, anything). The same card on the Ideas panel and on the Script page.
// Photos open large; documents open in a new tab. Files are uploaded exactly as they are (no shrinking).
export function IdeaAttachments({ ideaId, attachments, onChange }: { ideaId: string; attachments: IdeaAttachment[]; onChange: (next: IdeaAttachment[]) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  async function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await Promise.all(Array.from(files).map(uploadJournalAttachment));
      const rows = await addAttachmentsToEntry(ideaId, uploaded);
      onChange([...attachments, ...rows.map((r) => ({ id: r.id as string, fileUrl: r.file_url as string, fileType: (r.file_type as string | null) ?? null, fileName: (r.file_name as string | null) ?? null }))]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't attach that file.");
    }
    setUploading(false);
  }

  function remove(id: string) {
    onChange(attachments.filter((a) => a.id !== id));
    startTransition(async () => {
      await removeAttachment(id);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[#F0F0F1] bg-white px-3 py-2.5 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:px-4">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold max-md:text-[15px]">Attachments</span>
        <span className="rounded-[10px] bg-[#F0F0F1] px-2 py-0.5 text-[11px] font-extrabold">{attachments.length}</span>
      </div>
      {attachments.map((a) => {
        const isImg = a.fileType?.startsWith("image/");
        const ext = (a.fileName?.split(".").pop() || "").toUpperCase().slice(0, 4);
        const open = () => (isImg ? setLightbox(a.fileUrl) : window.open(a.fileUrl, "_blank", "noopener,noreferrer"));
        return (
          <div key={a.id} className="flex items-center gap-2.5">
            <button type="button" onClick={open} title={a.fileName ?? ""} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-0.5 text-left hover:text-[#FF1F8F] max-md:min-h-11">
              <span className="relative flex size-9 flex-none items-center justify-center overflow-hidden rounded-md bg-[#FFD9EB] text-[10.5px] font-black tracking-[0.04em]">
                {isImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.fileUrl} alt="" className="absolute inset-0 size-full object-cover" />
                ) : (
                  ext || "FILE"
                )}
              </span>
              <span className="min-w-0 flex-1 text-[13px] leading-snug font-semibold break-words max-md:text-[14.5px]">{a.fileName || "Attachment"}</span>
            </button>
            <button type="button" onClick={() => remove(a.id)} title="Remove" aria-label="Remove attachment" className="flex size-8 flex-none items-center justify-center rounded-full text-[#6b6b69] hover:bg-[#F0F0F1] hover:text-[#0D0D0D] max-md:size-11">
              <MaterialIcon name="close" size={16} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={uploading}
        className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-dashed border-[#CFCFCD] text-[13px] font-bold text-[#4a4a48] hover:border-[#0D0D0D] hover:text-[#0D0D0D] disabled:opacity-60 max-md:h-11 max-md:text-[14.5px]"
      >
        {uploading ? <EqualizerIcon size={15} /> : <MaterialIcon name="attach_file" size={17} />}
        {uploading ? "Uploading…" : "Attach A File"}
      </button>
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      {error && <span className="text-[12.5px] font-semibold text-[#D10A6E]">{error}</span>}
      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(13,13,13,0.8)] p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-md object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
