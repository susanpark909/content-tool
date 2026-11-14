"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { IdeaFormat } from "@/lib/idea-format";

// Nothing gets scheduled until its format has been picked. This asks, every time an idea goes onto the calendar.
// (Library board drops also need a date, because the board has no date to use.)
const CHOICES: { key: IdeaFormat; label: string; icon: string }[] = [
  { key: "reel", label: "Reel", icon: "smart_display" },
  { key: "broll", label: "B-Roll + Text", icon: "movie" },
  { key: "carousel", label: "Carousel", icon: "collections" },
];

export function FormatGate({
  title,
  needDate,
  onDone,
  onCancel,
}: {
  title?: string;
  needDate?: boolean;
  onDone: (format: IdeaFormat, date: string | null) => void;
  onCancel: () => void;
}) {
  const [format, setFormat] = useState<IdeaFormat | null>(null);
  const [date, setDate] = useState("");
  const ready = format != null && (!needDate || date !== "");
  return (
    <div onClick={onCancel} className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(13,13,13,0.28)] p-6 backdrop-blur-[6px] max-md:p-3">
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-[420px] flex-col gap-4 rounded-[14px] border border-[#F0F0F1] bg-white p-5 shadow-[0_24px_72px_rgba(13,13,13,0.28)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xl font-extrabold tracking-[-0.01em]">What Format Is It?</span>
            <span className="text-[13px] font-medium text-[#4a4a48]">{title ?? "Pick one before it goes on the calendar."}</span>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="flex size-8 flex-none items-center justify-center rounded-md text-[#4a4a48] hover:bg-[#F0F0F1]">
            <MaterialIcon name="close" size={20} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
          {CHOICES.map((c) => {
            const on = format === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setFormat(c.key)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-[13px] font-bold max-md:flex-row max-md:justify-center ${on ? "border-[#0D0D0D] bg-[#F0F0F1]" : "border-[#E4E4E2] bg-white hover:bg-[#F6F6F5]"}`}
              >
                <MaterialIcon name={c.icon} size={22} />
                {c.label}
              </button>
            );
          })}
        </div>
        {needDate && (
          <label className="flex flex-col gap-1 text-[12.5px] font-bold text-[#4a4a48]">
            Scheduled Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 rounded-md border border-[#E4E4E2] bg-white px-3 text-[14px] font-semibold text-[#0D0D0D] outline-none focus:border-[#0D0D0D]"
            />
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-md border border-[#E4E4E2] bg-white px-4 text-[13.5px] font-bold hover:bg-[#F6F6F5]">
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => format && onDone(format, needDate ? date : null)}
            className="h-10 rounded-md bg-[#FF1F8F] px-4 text-[13.5px] font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#FF1F8F] disabled:hover:text-[#0D0D0D]"
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
