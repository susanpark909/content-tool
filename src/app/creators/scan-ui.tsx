"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui/material-icon";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { Dropdown } from "@/components/dropdown";
import { listActiveScans, persistThumbnails, pollScan, startCreatorScan, type ScanJobView } from "./scan-actions";

const RANGES = [
  { value: "all", label: "Any time" },
  { value: "30", label: "Last 30 days" },
  { value: "60", label: "Last 60 days" },
  { value: "90", label: "Last 90 days" },
  { value: "custom", label: "Custom" },
];

const isoDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// The "Add Creator" button and the live progress of any scans that are running.
export function CreatorScanner({ initial }: { initial: ScanJobView[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<ScanJobView[]>(initial);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<number | null>(null); // pictures left to save
  const polling = useRef(false);

  // Pick up scans started earlier (or on another device) when you land on the page.
  useEffect(() => {
    listActiveScans().then((active) => setJobs((cur) => [...cur.filter((j) => !active.some((a) => a.id === j.id)), ...active])).catch(() => {});
  }, []);

  const live = jobs.filter((j) => j.status === "running" || j.status === "importing");
  const liveKey = live.map((j) => j.id).join(",");

  useEffect(() => {
    if (!liveKey) return;
    const tick = async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        const ids = liveKey.split(",");
        const next = await Promise.all(ids.map((id) => pollScan(id).catch(() => null)));
        let finished = false;
        setJobs((cur) =>
          cur.map((j) => {
            const n = next.find((x) => x && x.id === j.id);
            if (n && j.status !== n.status && (n.status === "done" || n.status === "error")) finished = true;
            return n ?? j;
          }),
        );
        if (finished) {
          router.refresh();
          // save the pictures, a few dozen at a time
          let left = 1;
          setSaving(1);
          while (left > 0) {
            const r = await persistThumbnails(40).catch(() => ({ processed: 0, remaining: 0 }));
            left = r.remaining;
            setSaving(left > 0 ? left : null);
            if (r.processed === 0 && left > 0) break;
          }
          setSaving(null);
          router.refresh();
        }
      } finally {
        polling.current = false;
      }
    };
    const t = setInterval(tick, 3000);
    tick();
    return () => clearInterval(t);
  }, [liveKey, router]);

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-11 items-center gap-2 rounded-full bg-[#FF1F8F] pr-5 pl-3.5 text-[14px] font-extrabold text-[#0D0D0D] shadow-[0_6px_16px_rgba(255,31,143,0.25)] hover:bg-[#0D0D0D] hover:text-[#FF1F8F]"
          >
            <MaterialIcon name="add" size={22} weight={500} /> Add Creator
          </button>
        </div>
        {jobs.map((j) => (
          <div key={j.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[#F0F0F1] bg-white px-4 py-3 shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
            {j.status === "done" ? (
              <span className="flex size-9 flex-none items-center justify-center rounded-full bg-[#EAF8D8] text-[#3a8a00]">
                <MaterialIcon name="check_circle" size={20} />
              </span>
            ) : j.status === "error" ? (
              <span className="flex size-9 flex-none items-center justify-center rounded-full bg-[#FFF0F7] text-[#D10A6E]">
                <MaterialIcon name="warning" size={20} />
              </span>
            ) : (
              <span className="flex size-9 flex-none items-center justify-center rounded-full bg-[#FFF0F7] text-[#FF1F8F]">
                <EqualizerIcon size={18} />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[14px] font-extrabold">
                {j.status === "done" ? `@${j.username} scanned` : j.status === "error" ? `@${j.username} couldn't be scanned` : j.status === "importing" ? `Saving @${j.username}'s ${j.kind}…` : `Scanning @${j.username}'s ${j.kind}…`}
              </span>
              <span className="text-[12.5px] font-medium text-[#4a4a48]">
                {j.status === "running" && (j.found > 0 ? `${j.found.toLocaleString("en-US")} ${j.kind} found so far. You can leave this page. It keeps going.` : "Starting up. You can leave this page. It keeps going.")}
                {j.status === "importing" && `${j.found.toLocaleString("en-US")} ${j.kind} found. Adding them now.`}
                {j.status === "done" && (j.added === 0 ? `Nothing new. All ${j.skipped} ${j.kind} were already saved.` : `Added ${j.added.toLocaleString("en-US")} new ${j.kind}${j.skipped > 0 ? `. ${j.skipped} were already saved.` : "."}`)}
                {j.status === "error" && (j.error ?? "Something went wrong.")}
              </span>
              {j.status === "running" && (
                <span className="mt-1.5 h-1.5 w-full max-w-[360px] overflow-hidden rounded-full bg-[#F0F0F1]">
                  <span className="block h-full w-1/3 animate-pulse rounded-full bg-[#FF1F8F]" />
                </span>
              )}
            </div>
            {j.status === "done" && j.added + j.skipped > 0 && (
              <Link href={`/creators/${encodeURIComponent(j.username)}`} className="flex h-9 items-center gap-1.5 rounded-md border border-[#E4E4E2] px-3.5 text-[13px] font-bold hover:border-[#0D0D0D]">
                Open <MaterialIcon name="arrow_forward" size={16} />
              </Link>
            )}
            {(j.status === "done" || j.status === "error") && (
              <button type="button" onClick={() => setJobs((cur) => cur.filter((x) => x.id !== j.id))} aria-label="Dismiss" className="flex size-8 items-center justify-center rounded-md text-[#6b6b69] hover:bg-[#F0F0F1]">
                <MaterialIcon name="close" size={18} />
              </button>
            )}
          </div>
        ))}
        {saving != null && (
          <span className="flex items-center gap-2 text-[12.5px] font-semibold text-[#4a4a48]">
            <EqualizerIcon size={14} /> Saving pictures{saving > 1 ? ` (${saving.toLocaleString("en-US")} left)` : ""}…
          </span>
        )}
      </div>
      {open && (
        <ScanDialog
          onClose={() => setOpen(false)}
          onStarted={(job) => {
            setJobs((cur) => [job, ...cur.filter((j) => j.id !== job.id)]);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function ScanDialog({ onClose, onStarted }: { onClose: () => void; onStarted: (job: ScanJobView) => void }) {
  const [input, setInput] = useState("");
  const [count, setCount] = useState("");
  const [range, setRange] = useState("all");
  const [kind, setKind] = useState<"reels" | "carousels" | "both">("reels");
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function go() {
    if (!input.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const started = await startCreatorScan({ input, limit: Number(count) || null, range, from, to, kind });
      started.forEach(onStarted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the scan");
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(13,13,13,0.35)] p-4 backdrop-blur-[6px]">
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-[480px] flex-col gap-4 rounded-2xl border border-[#F0F0F1] bg-white p-5 shadow-[0_24px_72px_rgba(13,13,13,0.28)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[22px] font-extrabold tracking-[-0.01em]">Add A Creator</span>
            <span className="text-[12.5px] font-medium text-[#4a4a48]">Scan their reels, carousels or both: views, likes, comments and date. Pick the ones to analyze after.</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 flex-none items-center justify-center rounded-md hover:bg-[#F0F0F1]">
            <MaterialIcon name="close" size={22} />
          </button>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-extrabold tracking-wide text-[#6b6b69] uppercase">Instagram profile</span>
          <div className="flex h-11 items-center gap-2 rounded-md border border-[#E4E4E2] px-3 focus-within:border-[#0D0D0D]">
            <MaterialIcon name="link" size={19} className="text-[#4a4a48]" />
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && go()}
              placeholder="Paste a profile link or @handle"
              className="min-w-0 flex-1 border-0 bg-transparent text-[14px] font-medium outline-none"
            />
          </div>
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-extrabold tracking-wide text-[#6b6b69] uppercase">What to scan</span>
          <div className="flex h-11 overflow-hidden rounded-md border border-[#E4E4E2]">
            {([["reels", "smart_display", "Reels"], ["carousels", "collections", "Carousels"], ["both", "layers", "Both"]] as const).map(([v, icon, label]) => (
              <button key={v} type="button" onClick={() => setKind(v)} className="flex flex-1 items-center justify-center gap-1.5 text-[13.5px] font-bold hover:text-[#FF1F8F]" style={{ background: kind === v ? "#F0F0F1" : undefined }}>
                <MaterialIcon name={icon} size={18} /> {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-extrabold tracking-wide text-[#6b6b69] uppercase"># of posts</span>
            <input
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
              placeholder="All"
              className="h-11 rounded-md border border-[#E4E4E2] px-3 text-[14px] font-semibold outline-none focus:border-[#0D0D0D]"
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-extrabold tracking-wide text-[#6b6b69] uppercase">Posted</span>
            <Dropdown value={range} onChange={setRange} options={RANGES} />
          </div>
        </div>
        {range === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[#4a4a48]">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-md border border-[#E4E4E2] px-2 text-[13px] font-semibold text-[#0D0D0D] outline-none" />
            to
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-md border border-[#E4E4E2] px-2 text-[13px] font-semibold text-[#0D0D0D] outline-none" />
          </div>
        )}
        {error && <span className="text-[13px] font-semibold text-[#D10A6E]">{error}</span>}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] font-medium text-[#6b6b69]">Posts you already have are skipped, never copied.</span>
          <button
            type="button"
            onClick={go}
            disabled={!input.trim() || busy}
            className="flex h-11 flex-none items-center gap-1.5 rounded-lg bg-[#FF1F8F] px-5 text-[14px] font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:bg-[#E4E4E2] disabled:text-[#9a9a98]"
          >
            {busy ? <EqualizerIcon size={16} /> : <MaterialIcon name="radar" size={19} />}
            {busy ? "Starting…" : "Scan"}
          </button>
        </div>
      </div>
    </div>
  );
}
