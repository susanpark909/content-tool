"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { dismissAnalysisLinks } from "./analysis-links-actions";

export type AnalysisLinkRow = { id: string; url: string; status: "working" | "done" | "error"; note: string | null };

const shortLink = (url: string) => url.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "");

// Shows every link you sent for analysis: working on it, done, or failed (with the link to copy and paste again).
export function AnalysisStatus({ rows }: { rows: AnalysisLinkRow[] }) {
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);
  const working = rows.some((r) => r.status === "working");
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [working, router]);
  if (rows.length === 0) return null;
  const failed = rows.filter((r) => r.status === "error");

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-[#F0F0F1] bg-white p-3 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[20px] font-black tracking-[-0.02em] md:text-[26px]">Analysis Status</span>
        <span className="flex items-center gap-3">
          {failed.length > 1 && (
            <button type="button" onClick={() => copy("all", failed.map((r) => r.url).join("\n"))} className="text-[13px] font-extrabold text-[#FF1F8F] hover:text-[#0D0D0D]">
              {copied === "all" ? "Copied" : `Copy ${failed.length} Failed Links`}
            </button>
          )}
          {rows.some((r) => r.status !== "working") && (
            <button type="button" onClick={() => dismissAnalysisLinks(rows.filter((r) => r.status !== "working").map((r) => r.id)).then(() => router.refresh())} className="text-[13px] font-bold text-[#6b6b69] hover:text-[#0D0D0D]">
              Clear
            </button>
          )}
        </span>
      </div>
      <div className="flex flex-col">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#F0F0F1] py-2.5 first:border-t-0">
            <span className="flex size-7 flex-none items-center justify-center">
              {r.status === "working" ? <EqualizerIcon size={18} /> : r.status === "done" ? <MaterialIcon name="check_circle" size={20} className="text-[#4CAF00]" /> : <MaterialIcon name="error" size={20} className="text-[#D10A6E]" />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[14px] font-bold break-all">{shortLink(r.url)}</span>
              <span className={`text-[12.5px] font-semibold ${r.status === "error" ? "text-[#D10A6E]" : "text-[#4a4a48]"}`}>
                {r.status === "working" ? "Analyzing now. This takes about a minute." : r.status === "done" ? (r.note ?? "Done. It's in your Library.") : (r.note ?? "This one failed.")}
              </span>
            </span>
            {r.status === "error" && (
              <span className="flex items-center gap-2">
                <button type="button" onClick={() => copy(r.id, r.url)} className="flex h-9 items-center gap-1.5 rounded-md border border-[#E4E4E2] px-3 text-[13px] font-extrabold hover:border-[#0D0D0D]">
                  <MaterialIcon name="content_copy" size={16} /> {copied === r.id ? "Copied" : "Copy Link"}
                </button>
                <button type="button" onClick={() => dismissAnalysisLinks([r.id]).then(() => router.refresh())} aria-label="Dismiss" className="flex size-9 items-center justify-center rounded-md text-[#6b6b69] hover:bg-[#F0F0F1]">
                  <MaterialIcon name="close" size={18} />
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
