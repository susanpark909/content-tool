"use client";

import { useEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { downloadExport, type ExportData, type ExportFormat } from "@/lib/export-files";

export type DownloadChoice = { id: string; label: string; count?: number };

// One "Download" button that offers Word, PDF or Excel for whatever the page is showing.
// With `choices` it first lets you pick which parts to include (for example which columns), everything by default.
export function DownloadMenu({
  getData,
  className = "",
  label = "Download",
  choicesTitle = "Include",
  choices,
}: {
  getData: (selected: string[] | null) => ExportData | Promise<ExportData>;
  className?: string;
  label?: string;
  choicesTitle?: string;
  choices?: DownloadChoice[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);
  const ids = (choices ?? []).map((c) => c.id);
  const allPicked = ids.length > 0 && ids.every((id) => picked.has(id));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  function toggleOpen() {
    // everything is ticked each time you open it
    if (!open && choices) setPicked(new Set(choices.map((c) => c.id)));
    setOpen((v) => !v);
  }

  async function go(f: ExportFormat) {
    setBusy(f);
    setError(null);
    try {
      await downloadExport(f, await getData(choices && !allPicked ? [...picked] : null));
      setOpen(false);
    } catch {
      setError("Couldn't make that file. Try another format.");
    } finally {
      setBusy(null);
    }
  }

  const opts: { f: ExportFormat; text: string; icon: string }[] = [
    { f: "word", text: "Word", icon: "description" },
    { f: "pdf", text: "PDF", icon: "picture_as_pdf" },
    { f: "excel", text: "Excel", icon: "table_chart" },
  ];

  const box = (on: boolean) => (
    <span className="flex size-[18px] flex-none items-center justify-center rounded-[4px] border-[1.5px]" style={{ background: on ? "#0D0D0D" : "#FFFFFF", borderColor: on ? "#0D0D0D" : "#BDBDBB" }}>
      {on && <MaterialIcon name="check" size={13} weight={500} className="text-white" />}
    </span>
  );

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={toggleOpen} className="flex h-10 items-center gap-1.5 rounded-md border border-[#E4E4E2] bg-white px-3.5 text-[13.5px] font-bold hover:border-[#0D0D0D]">
        <MaterialIcon name="download" size={18} /> {label}
      </button>
      {open && (
        <div className={`absolute right-0 z-[95] mt-1.5 flex flex-col rounded-lg border border-[#E4E4E2] bg-white py-1 shadow-[0_12px_32px_rgba(13,13,13,0.18)] ${choices ? "w-[260px]" : "w-[180px]"}`}>
          {choices && (
            <>
              <span className="px-3 pt-2 pb-1 text-[11px] font-extrabold tracking-wide text-[#6b6b69] uppercase">{choicesTitle}</span>
              <button type="button" onClick={() => setPicked(allPicked ? new Set() : new Set(ids))} className="flex h-10 items-center gap-2.5 px-3 text-left text-[14.5px] font-extrabold hover:bg-[#F6F6F5]">
                {box(allPicked)} Everything
              </button>
              {choices.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      return next;
                    })
                  }
                  className="flex h-10 items-center gap-2.5 px-3 text-left text-[14.5px] font-semibold hover:bg-[#F6F6F5]"
                >
                  {box(picked.has(c.id))}
                  <span className="min-w-0 flex-1 break-words">{c.label}</span>
                  {c.count != null && <span className="text-[12.5px] font-bold text-[#6b6b69]">{c.count}</span>}
                </button>
              ))}
              <span className="mx-3 my-1 h-px bg-[#F0F0F1]" />
              <span className="px-3 pt-1 pb-1 text-[11px] font-extrabold tracking-wide text-[#6b6b69] uppercase">Save as</span>
            </>
          )}
          {opts.map((o) => (
            <button key={o.f} type="button" disabled={busy != null || (!!choices && picked.size === 0)} onClick={() => void go(o.f)} className="flex h-11 items-center gap-2.5 px-3 text-left text-[15px] font-semibold hover:bg-[#F6F6F5] disabled:opacity-50">
              <MaterialIcon name={o.icon} size={20} className="text-[#4a4a48]" />
              {busy === o.f ? "Making it…" : o.text}
            </button>
          ))}
          {error && <span className="px-3 pt-1 pb-2 text-[12.5px] font-semibold text-[#D10A6E]">{error}</span>}
        </div>
      )}
    </div>
  );
}
