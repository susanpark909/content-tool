"use client";

import { useEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { downloadExport, type ExportData, type ExportFormat } from "@/lib/export-files";

// One "Download" button that offers Word, PDF or Excel for whatever the page is showing.
export function DownloadMenu({ getData, className = "", label = "Download" }: { getData: () => ExportData; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

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

  async function go(f: ExportFormat) {
    setBusy(f);
    setError(null);
    try {
      await downloadExport(f, getData());
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

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex h-10 items-center gap-1.5 rounded-md border border-[#E4E4E2] bg-white px-3.5 text-[13.5px] font-bold hover:border-[#0D0D0D]">
        <MaterialIcon name="download" size={18} /> {label}
      </button>
      {open && (
        <div className="absolute right-0 z-[95] mt-1.5 flex w-[180px] flex-col rounded-lg border border-[#E4E4E2] bg-white py-1 shadow-[0_12px_32px_rgba(13,13,13,0.18)]">
          {opts.map((o) => (
            <button key={o.f} type="button" disabled={busy != null} onClick={() => void go(o.f)} className="flex h-11 items-center gap-2.5 px-3 text-left text-[15px] font-semibold hover:bg-[#F6F6F5] disabled:opacity-60">
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
