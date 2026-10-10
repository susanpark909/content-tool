"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { MaterialIcon } from "@/components/ui/material-icon";
import { AutoTextarea } from "@/components/auto-textarea";
import { DictateButton } from "@/components/dictate-button";
import { copyText } from "@/lib/copy-text";
import { ExcludeCreators } from "@/components/exclude-creators";
import { NotesLane } from "./notes-lane";
import { OutlierFilter } from "@/components/outlier-filter";
import type { Outliers } from "@/lib/creator-typicals";
import type { OutlierGoal } from "@/lib/outlier";
import { useRememberedState } from "@/lib/use-remembered-state";
import { saveScriptSections, scheduleIdea, setIdeaDraft, setIdeaFormat, setIdeaGoal, setIdeaInspiration, setIdeaPosted, updateJournalContent } from "@/app/idea/actions";
import { getReelTranscript, listAttachableReels, type AttachableReel } from "../actions";
import { stageOf, type Idea } from "@/app/idea/idea-table";

export type ScriptReel = {
  id: string;
  url: string;
  caption: string | null;
  thumbnailUrl: string | null;
  owner: string | null;
  postedAt: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number | null;
  reposts: number | null;
  saves: number | null;
  durationSeconds: number | null;
  transcript: string | null;
  hook: string | null;
  cta: string | null;
  outlier: Outliers;
};
export type VaultHook = {
  id: string;
  hook: string;
  owner: string | null;
  postedAt: string | null;
  views: number;
  comments: number;
  shares: number | null;
  reposts: number | null;
  saves: number | null;
  goals: string[];
  outlier: Outliers;
  pinned?: boolean;
};

type Tab = "hook" | "script";
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "hook", label: "Hook", icon: "phishing" },
  { key: "script", label: "Script", icon: "edit_note" },
];

type HookSort = "views" | "comments" | "shares" | "saves" | "reposts" | "engagement";
const HOOK_SORTS: { key: HookSort; label: string; icon: string }[] = [
  { key: "views", label: "Most Views", icon: "visibility" },
  { key: "comments", label: "Most Comments", icon: "comment" },
  { key: "shares", label: "Most Shares", icon: "send" },
  { key: "saves", label: "Most Saves", icon: "bookmark" },
  { key: "reposts", label: "Most Reposts", icon: "repeat" },
  { key: "engagement", label: "Top Engagement", icon: "comment" },
];
const GOAL_FILTERS: { key: string; label: string; icon: string }[] = [
  { key: "all", label: "All Goals", icon: "target" },
  { key: "views", label: "Views", icon: "visibility" },
  { key: "shares", label: "Shares", icon: "send" },
  { key: "comments", label: "Comments", icon: "comment" },
  { key: "saves", label: "Saves", icon: "bookmark" },
];

// One look for every dropdown on this page: a button that opens an on-brand list (not the browser's own popup).
function Dropdown({ icon, value, onChange, options, compact = false, prefix }: { icon: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; compact?: boolean; prefix?: string }) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];
  function toggle() {
    if (pos) return setPos(null);
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.max(190, r.width);
    setPos({ top: Math.min(r.bottom + 4, window.innerHeight - 280), left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width });
  }
  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        className={`relative flex w-full cursor-pointer items-center rounded-md border border-[#E4E4E2] bg-white text-left font-semibold text-[#0D0D0D] hover:border-[#BDBDBB] ${compact ? "h-9 pr-7 pl-8 text-[12.5px]" : "h-10 pr-8 pl-9 text-[13px]"}`}
        style={{ borderColor: pos ? "#0D0D0D" : undefined }}
      >
        <MaterialIcon name={icon} size={compact ? 16 : 17} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#4a4a48]" />
        <span className="truncate">
          {prefix && <span className="mr-1 font-bold text-[#6b6b69]">{prefix}</span>}
          {current?.label}
        </span>
        <MaterialIcon name="expand_more" size={18} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[#4a4a48]" />
      </button>
      {pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[80]" onClick={() => setPos(null)} />
            <div style={{ top: pos.top, left: pos.left, width: pos.width }} className="fixed z-[81] flex max-h-[270px] flex-col overflow-y-auto rounded-lg border border-[#E4E4E2] bg-white py-1 shadow-[0_12px_32px_rgba(13,13,13,0.18)]">
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setPos(null);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold hover:bg-[#F6F6F5]"
                  style={{ background: o.value === value ? "#F0F0F1" : undefined }}
                >
                  <span className="flex size-4 flex-none items-center justify-center">{o.value === value && <MaterialIcon name="check" size={15} />}</span>
                  <span className="truncate">{o.label}</span>
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

// A labelled dropdown with a leading icon - used by every filter bar on this page.
function FilterSelect({ icon, value, onChange, options, label, compact = false }: { icon: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string; compact?: boolean }) {
  if (compact) return <Dropdown compact icon={icon} value={value} onChange={onChange} options={options} />;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-extrabold tracking-wide text-[#6b6b69] uppercase">{label}</span>
      <Dropdown icon={icon} value={value} onChange={onChange} options={options} />
    </div>
  );
}

// "Sort by" plus one small button that flips the order, so there's no second list of "least ..." options.
function SortField({ value, onChange, asc, onToggleAsc, compact = false }: { value: string; onChange: (v: string) => void; asc: boolean; onToggleAsc: () => void; compact?: boolean }) {
  const isDate = value === "date";
  const tip = asc ? (isDate ? "Oldest first. Click for newest first." : "Lowest first. Click for highest first.") : isDate ? "Newest first. Click for oldest first." : "Highest first. Click for lowest first.";
  if (compact)
    return (
      <div className="flex gap-1">
        <div className="min-w-[150px]">
          <Dropdown compact prefix="Sort" icon="swap_vert" value={value} onChange={onChange} options={SORT_OPTIONS} />
        </div>
        <button
          type="button"
          onClick={onToggleAsc}
          title={tip}
          aria-label={tip}
          className="flex size-9 flex-none items-center justify-center rounded-md border bg-white hover:border-[#0D0D0D]"
          style={{ borderColor: asc ? "#FF1F8F" : "#E4E4E2", color: asc ? "#FF1F8F" : "#0D0D0D" }}
        >
          <MaterialIcon name={asc ? "arrow_upward" : "arrow_downward"} size={18} />
        </button>
      </div>
    );
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-extrabold tracking-wide text-[#6b6b69] uppercase">Sort by</span>
      <div className="flex gap-1.5">
        <div className="min-w-0 flex-1">
          <Dropdown icon="swap_vert" value={value} onChange={onChange} options={SORT_OPTIONS} />
        </div>
        <button
          type="button"
          onClick={onToggleAsc}
          title={tip}
          aria-label={tip}
          className="flex size-10 flex-none items-center justify-center rounded-md border bg-white hover:border-[#0D0D0D]"
          style={{ borderColor: asc ? "#FF1F8F" : "#E4E4E2", color: asc ? "#FF1F8F" : "#0D0D0D" }}
        >
          <MaterialIcon name={asc ? "arrow_upward" : "arrow_downward"} size={19} />
        </button>
      </div>
    </div>
  );
}
const SORT_OPTIONS = [
  { value: "views", label: "Views" },
  { value: "comments", label: "Comments" },
  { value: "shares", label: "Shares" },
  { value: "saves", label: "Saves" },
  { value: "reposts", label: "Reposts" },
  { value: "engagement", label: "Engagement rate" },
  { value: "date", label: "Date posted" },
  { value: "outlier", label: "Outlier score" },
];
const GOAL_OPTIONS = [
  { value: "all", label: "All goals" },
  { value: "views", label: "Views" },
  { value: "shares", label: "Shares" },
  { value: "comments", label: "Comments" },
  { value: "saves", label: "Saves" },
];
type Metrics = { views: number; comments: number; shares: number | null; saves: number | null; reposts: number | null; postedAt?: string | null; outlier?: Outliers };
// Sorts highest first (or lowest first), with anything that has no number always at the bottom.
const byMetric = (key: string, asc: boolean, om: OutlierGoal = "views") => (x: Metrics, y: Metrics) => {
  const a = metricOf(x, key, om);
  const b = metricOf(y, key, om);
  if (a < 0 && b >= 0) return 1;
  if (b < 0 && a >= 0) return -1;
  return asc ? a - b : b - a;
};
function metricOf(h: Metrics, k: string, om: OutlierGoal = "views") {
  if (k === "outlier") return h.outlier?.[om] ?? -1;
  if (k === "date") return h.postedAt ? new Date(h.postedAt).getTime() : -1;
  return k === "views" ? h.views : k === "comments" ? h.comments : k === "shares" ? (h.shares ?? -1) : k === "saves" ? (h.saves ?? -1) : k === "reposts" ? (h.reposts ?? -1) : h.views > 0 ? h.comments / h.views : -1;
}

function AttachReelDialog({ onClose, onPick, currentId }: { onClose: () => void; onPick: (id: string | null) => void; currentId: string | null }) {
  const [reels, setReels] = useState<AttachableReel[] | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("views");
  const [asc, setAsc] = useState(false);
  const [outMetric, setOutMetric] = useState<OutlierGoal>("views");
  const [outMin, setOutMin] = useState(0);
  const [goal, setGoal] = useState("all");
  const [creator, setCreator] = useState<string[]>([]);
  const [excluded, setExcluded] = useRememberedState<string[]>("vh-attach-excluded", []);
  const [openId, setOpenId] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Record<string, { transcript: string | null; hook: string | null } | "loading">>({});
  function toggleOpen(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (!transcripts[id]) {
      setTranscripts((t) => ({ ...t, [id]: "loading" }));
      getReelTranscript(id)
        .then((r) => setTranscripts((t) => ({ ...t, [id]: r })))
        .catch(() => setTranscripts((t) => ({ ...t, [id]: { transcript: null, hook: null } })));
    }
  }
  useEffect(() => {
    listAttachableReels().then(setReels).catch(() => setReels([]));
  }, []);
  const creators = useMemo(() => Array.from(new Set((reels ?? []).map((r) => r.owner).filter((o): o is string => !!o))).sort(), [reels]);
  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (reels ?? [])
      .filter((r) => (goal === "all" || r.goals.includes(goal)) && (creator.length === 0 || (r.owner != null && creator.includes(r.owner))) && !(r.owner && excluded.includes(r.owner)) && (outMin === 0 || (r.outlier[outMetric] ?? -1) >= outMin) && (!query || r.text.toLowerCase().includes(query) || (r.owner ?? "").toLowerCase().includes(query)))
      .sort(byMetric(sort, asc, outMetric))
      .slice(0, 60);
  }, [reels, q, sort, asc, goal, creator, excluded, outMetric, outMin]);

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(13,13,13,0.35)] p-4 backdrop-blur-[6px] max-md:p-2">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-full w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-[#F0F0F1] bg-white shadow-[0_24px_72px_rgba(13,13,13,0.28)]">
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <span className="text-[22px] font-extrabold tracking-[-0.01em]">Attach A Reel</span>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-md hover:bg-[#F0F0F1]">
            <MaterialIcon name="close" size={22} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-[#F0F0F1] px-5 pb-3">
          <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-md border border-[#E4E4E2] px-2.5 focus-within:border-[#0D0D0D]">
            <MaterialIcon name="search" size={17} className="text-[#4a4a48]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reels or creators…" autoComplete="off" className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-medium outline-none" />
          </div>
          <SortField compact value={sort} onChange={setSort} asc={asc} onToggleAsc={() => setAsc((v) => !v)} />
          <div className="w-[130px]">
            <FilterSelect compact label="Built for" icon="target" value={goal} onChange={setGoal} options={GOAL_OPTIONS} />
          </div>
          <ExcludeCreators compact variant="include" heightClass="h-9" className="w-[150px]" creators={creators} value={creator} onChange={setCreator} />
          <ExcludeCreators compact heightClass="h-9" className="w-[150px]" creators={creators} value={excluded} onChange={setExcluded} />
          <OutlierFilter metric={outMetric} min={outMin} onChange={(m, n) => { setOutMetric(m); setOutMin(n); }} />
          <button
            type="button"
            disabled={!(q || goal !== "all" || creator.length > 0 || sort !== "views" || asc || excluded.length > 0 || outMin > 0)}
            onClick={() => {
              setQ("");
              setGoal("all");
              setCreator([]);
              setSort("views");
              setAsc(false);
              setExcluded([]);
              setOutMin(0);
            }}
            title="Clear filters"
            aria-label="Clear filters"
            className="ml-auto flex h-8 items-center gap-1 rounded-md border border-[#E4E4E2] px-2 text-[12px] font-bold text-[#D10A6E] hover:border-[#D10A6E] disabled:text-[#9a9a98] disabled:hover:border-[#E4E4E2]"
          >
            <MaterialIcon name="filter_alt_off" size={15} /> Clear
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {reels === null && <span className="px-5 py-8 text-center text-sm font-medium text-[#4a4a48]">Loading your reels…</span>}
          {reels && list.length === 0 && <span className="px-5 py-8 text-center text-sm font-medium text-[#4a4a48]">No reels match these filters.</span>}
          {list.map((r) => (
            <div key={r.id} className="flex flex-col border-b border-[#F0F0F1] last:border-b-0">
            <div onClick={() => toggleOpen(r.id)} className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-[#FBFBFA]">
              <span className="relative h-14 w-11 flex-none overflow-hidden rounded bg-[#2b2b29]">
                {r.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="line-clamp-2 text-[13.5px] leading-[1.3] font-bold">{r.text || "(no caption)"}</span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] font-bold text-[#4a4a48] [font-variant-numeric:tabular-nums]">
                  <span className="text-[#6b6b69]">{r.owner ? "@" + r.owner : ""}</span>
                  {r.postedAt && (
                    <span className="flex items-center gap-1" title="Date posted">
                      <MaterialIcon name="event" size={12} /> {shortDate(r.postedAt)}
                    </span>
                  )}
                  <OutlierChip outlier={r.outlier} metric={outMetric} />
                  <span className="flex items-center gap-1" title="Views"><MaterialIcon name="visibility" size={12} /> {fmtN(r.views)}</span>
                  <span className="flex items-center gap-1" title="Comments"><MaterialIcon name="comment" size={12} /> {fmtN(r.comments)}</span>
                  <span className="flex items-center gap-1" title="Shares"><MaterialIcon name="send" size={12} /> {r.shares == null ? "—" : fmtN(r.shares)}</span>
                  <span className="flex items-center gap-1" title="Saves"><MaterialIcon name="bookmark" size={12} /> {r.saves == null ? "—" : fmtN(r.saves)}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPick(r.id);
                }}
                disabled={r.id === currentId}
                className="flex h-9 flex-none items-center gap-1.5 rounded-md bg-[#FF1F8F] px-3.5 text-[12.5px] font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:bg-[#E4E4E2] disabled:text-[#9a9a98]"
              >
                {r.id === currentId ? "Attached" : "Attach"}
              </button>
              <MaterialIcon name={openId === r.id ? "expand_less" : "expand_more"} size={20} className="flex-none text-[#9a9a98]" />
            </div>
            {openId === r.id && (
              <div className="mx-5 mb-3 flex flex-col gap-2 rounded-lg bg-[#F6F6F5] p-3.5">
                {transcripts[r.id] === "loading" || !transcripts[r.id] ? (
                  <span className="text-[13px] font-medium text-[#4a4a48]">Loading transcript…</span>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-[#4a4a48] uppercase">
                      <MaterialIcon name="graphic_eq" size={14} className="text-[#FF1F8F]" /> Transcript
                    </span>
                    <p className="max-h-[220px] overflow-y-auto text-[13.5px] leading-[1.6] whitespace-pre-wrap text-[#2a2a28] [scrollbar-width:thin]">
                      {(transcripts[r.id] as { transcript: string | null }).transcript?.trim() || "Not transcribed yet."}
                    </p>
                  </>
                )}
              </div>
            )}
            </div>
          ))}
        </div>
        {currentId && (
          <div className="border-t border-[#F0F0F1] px-5 py-3">
            <button type="button" onClick={() => onPick(null)} className="text-[13px] font-bold text-[#D10A6E] hover:underline">
              Remove the attached reel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const shortDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
function OutlierChip({ outlier, metric }: { outlier: Outliers; metric: OutlierGoal }) {
  const v = outlier[metric];
  if (v == null) return null;
  return (
    <span
      className="flex items-center gap-1 rounded-md px-1.5 py-0.5"
      style={{ background: v >= 3 ? "#C6FF3D" : v >= 1.5 ? "#EAF8D8" : "#F0F0F1" }}
      title={`${metric} outlier score: ${v.toFixed(1)}x that creator's typical reel`}
    >
      <MaterialIcon name="rocket_launch" size={13} /> {v >= 10 ? v.toFixed(0) : v.toFixed(1)}x
    </span>
  );
}
function fmtN(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
}
const pct = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(n / d >= 0.1 ? 1 : 2) + "%" : "—");

export function ScriptPageClient({ idea, reel, vault }: { idea: Idea; reel: ScriptReel | null; vault: VaultHook[] }) {
  const [tab, setTab] = useState<Tab>("script");
  const [text, setText] = useState(idea.text);
  // The hook sits in its own small block above the script so it's clear which part was brought over.
  const [hook, setHook] = useState(idea.hook);
  // The idea IS the script: if nothing's been written yet, the box starts with the idea text.
  const [script, setScript] = useState([idea.body, idea.cta].filter((t) => t.trim()).join("\n\n") || idea.text);
  const [scriptId, setScriptId] = useState(idea.scriptId);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hookSort, setHookSort] = useState<string>("views");
  const [goalFilter, setGoalFilter] = useState("all");
  const [hookQuery, setHookQuery] = useState("");
  const [hookCreator, setHookCreator] = useState<string[]>([]);
  const [hookAsc, setHookAsc] = useState(false);
  const [hookOutMetric, setHookOutMetric] = useState<OutlierGoal>("views");
  const [hookOutMin, setHookOutMin] = useState(0);
  const [hookExcluded, setHookExcluded] = useRememberedState<string[]>("vh-hook-excluded", []);
  const [attachOpen, setAttachOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(idea.scheduledDate ?? "");
  const [posted, setPosted] = useState(idea.posted);
  const [draft, setDraft] = useState(idea.draft);
  const [format, setFormat] = useState(idea.format);
  const [goal, setGoal] = useState<string>(idea.goal ?? "");
  const [editedAt, setEditedAt] = useState(idea.updatedAt);
  const [editingTitle, setEditingTitle] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();
  function attach(reelId: string | null) {
    setAttachOpen(false);
    startTransition(async () => {
      await setIdeaInspiration(idea.id, reelId);
      router.refresh();
    });
  }
  const latest = useRef(script);
  latest.current = script;
  const latestHook = useRef(hook);
  latestHook.current = hook;

  function saveScript(value: string, hookValue: string = latestHook.current) {
    startTransition(async () => {
      const id = await saveScriptSections(idea.id, scriptId, { hook: hookValue, body: value, cta: "" });
      if (id && id !== scriptId) setScriptId(id);
      touched();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }
  const stage = stageOf({ ...idea, scheduledDate: scheduledDate || null, posted, draft, hook, body: !idea.body.trim() && !idea.cta.trim() && script === idea.text ? "" : script, cta: "" });
  const touched = () => setEditedAt(new Date().toISOString());
  function changeStatus(v: string) {
    if (v === "posted") {
      setPosted(true);
      setDraft(false);
      startTransition(async () => {
        await setIdeaPosted(idea.id, true);
        if (draft) await setIdeaDraft(idea.id, false);
        touched();
      });
    } else if (v === "sched") {
      const date = scheduledDate || new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      setScheduledDate(date);
      setPosted(false);
      setDraft(false);
      startTransition(async () => {
        await scheduleIdea(idea.id, date);
        if (posted) await setIdeaPosted(idea.id, false);
        if (draft) await setIdeaDraft(idea.id, false);
        touched();
      });
    } else {
      // Draft / Scripted: off the calendar and not posted
      const asDraft = v === "raw";
      setScheduledDate("");
      setPosted(false);
      setDraft(asDraft);
      startTransition(async () => {
        await scheduleIdea(idea.id, null);
        if (posted) await setIdeaPosted(idea.id, false);
        await setIdeaDraft(idea.id, asDraft);
        touched();
      });
    }
  }
  function changeDate(v: string) {
    setScheduledDate(v);
    if (!v) return;
    setPosted(false);
    startTransition(async () => {
      await scheduleIdea(idea.id, v);
      touched();
    });
  }
  function changeFormat(v: string) {
    setFormat(v as "reel" | "carousel");
    startTransition(async () => {
      await setIdeaFormat(idea.id, v as "reel" | "carousel");
      touched();
    });
  }
  function changeGoal(v: string) {
    setGoal(v);
    startTransition(async () => {
      await setIdeaGoal(idea.id, (v || null) as "views" | "comments" | "shares" | null);
      touched();
    });
  }
  const niceDate = (v: string) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  function saveText() {
    if (text === idea.text) return;
    startTransition(async () => {
      await updateJournalContent(idea.id, text);
    });
  }
  // The hook and idea blocks are reference points, so only the script itself is counted and copied.
  const words = script.trim() ? script.trim().split(/\s+/).length : 0;
  const sec = Math.round((words / 220) * 60);
  const narration = words === 0 ? "0 words" : `${words} words  •  ~${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} to narrate`;
  const spoken = (cur: string, t: string) => (cur.trim() ? cur.replace(/\s+$/, "") + " " + t : t);

  const hookCreators = useMemo(() => Array.from(new Set(vault.map((h) => h.owner).filter((o): o is string => !!o))).sort(), [vault]);
  const hooks = useMemo(() => {
    const q = hookQuery.trim().toLowerCase();
    // The hook from the reel you picked is always the first one you can use, whatever the filters say.
    const pinned: VaultHook | null = reel?.hook?.trim()
      ? { id: "picked-" + reel.id, hook: reel.hook.trim(), owner: reel.owner, postedAt: reel.postedAt, views: reel.views, comments: reel.comments, shares: reel.shares, reposts: reel.reposts, saves: reel.saves, goals: [], outlier: reel.outlier, pinned: true }
      : null;
    const rest = vault
      .filter(
        (h) =>
          h.id !== reel?.id &&
          !(pinned && h.hook.trim() === pinned.hook) &&
          !(h.owner && hookExcluded.includes(h.owner)) &&
          (hookOutMin === 0 || (h.outlier[hookOutMetric] ?? -1) >= hookOutMin) &&
          (goalFilter === "all" || h.goals.includes(goalFilter)) &&
          (hookCreator.length === 0 || (h.owner != null && hookCreator.includes(h.owner))) &&
          (!q || h.hook.toLowerCase().includes(q) || (h.owner ?? "").toLowerCase().includes(q)),
      )
      .sort(byMetric(hookSort, hookAsc, hookOutMetric))
      .slice(0, 40);
    return pinned ? [pinned, ...rest] : rest;
  }, [vault, reel, hookSort, hookAsc, goalFilter, hookQuery, hookCreator, hookExcluded, hookOutMetric, hookOutMin]);
  const hookFiltersOn = hookQuery !== "" || goalFilter !== "all" || hookCreator.length > 0 || hookSort !== "views" || hookAsc || hookExcluded.length > 0 || hookOutMin > 0;

  const card = "rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]";

  return (
    <div className="flex flex-col gap-3.5 md:gap-5">
      <BackLink fallbackHref="/scripts" label="Back to Scripts" />
      {editingTitle ? (
        <AutoTextarea
          autoFocus
          value={text}
          onChange={setText}
          onBlur={() => {
            saveText();
            setEditingTitle(false);
          }}
          minRows={1}
          className="w-full border-0 bg-transparent text-[20px] leading-[1.15] font-black tracking-[-0.03em] outline-none md:text-[28px]"
        />
      ) : (
        <h1
          onClick={() => setEditingTitle(true)}
          className="group line-clamp-2 cursor-text text-[20px] leading-[1.15] font-black tracking-[-0.03em] md:text-[28px]"
          title="Click to rename"
        >
          {text || "Untitled idea"}
          <MaterialIcon name="edit" size={18} className="ml-2 align-middle text-[#BDBDBB] group-hover:text-[#FF1F8F]" />
        </h1>
      )}

      <div className="flex flex-col gap-2.5 rounded-lg border border-[#F0F0F1] bg-white p-3.5 shadow-[0_4px_16px_rgba(13,13,13,0.06)]">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <FilterSelect
            label="Status"
            icon="pending_actions"
            value={stage}
            onChange={changeStatus}
            options={[
              { value: "raw", label: "Draft" },
              { value: "scripted", label: "Scripted" },
              { value: "sched", label: "Scheduled" },
              { value: "posted", label: "Posted" },
            ]}
          />
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-extrabold tracking-wide text-[#6b6b69] uppercase">Scheduled date</span>
            <span className="relative">
              <MaterialIcon name="event" size={17} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#4a4a48]" />
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => changeDate(e.target.value)}
                className="h-10 w-full rounded-md border border-[#E4E4E2] bg-white pr-2 pl-9 text-[13px] font-semibold outline-none hover:border-[#BDBDBB] focus:border-[#0D0D0D]"
              />
            </span>
          </label>
          <FilterSelect
            label="Format"
            icon="smart_display"
            value={format}
            onChange={changeFormat}
            options={[
              { value: "reel", label: "Reel" },
              { value: "carousel", label: "Carousel" },
            ]}
          />
          <FilterSelect
            label="Goal"
            icon="target"
            value={goal}
            onChange={changeGoal}
            options={[
              { value: "", label: "No goal yet" },
              { value: "views", label: "Views" },
              { value: "comments", label: "Comments" },
              { value: "shares", label: "Shares" },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] font-semibold text-[#4a4a48]">
          <span className="flex items-center gap-1.5">
            <MaterialIcon name="add_circle" size={15} /> Created {niceDate(idea.createdAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <MaterialIcon name="edit_calendar" size={15} /> Last edited {niceDate(editedAt)}
          </span>
          <span className="flex items-center gap-1.5" style={{ color: reel ? "#D10A6E" : undefined }}>
            <MaterialIcon name="smart_display" size={15} /> {reel ? `Reel picked${reel.owner ? " (@" + reel.owner + ")" : ""}` : "No reel picked yet"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_minmax(0,1fr)] md:items-start md:gap-6">
        {/* Left: the reel you're studying + its transcript, always in view while you write */}
        <aside className="flex flex-col gap-3 md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:overflow-y-auto md:pr-1 [scrollbar-width:thin]">
          {reel ? (
            <>
              <div className={`${card} flex shrink-0 flex-col overflow-hidden max-md:flex-row`}>
                <a
                  href={reel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open on Instagram"
                  className="relative block aspect-[3/4] w-full flex-none bg-[#2b2b29] max-md:w-[120px]"
                >
                  {reel.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={reel.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />
                  )}
                  {reel.durationSeconds != null && (
                    <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11.5px] font-bold text-white [font-variant-numeric:tabular-nums]" title="Reel length">
                      {Math.floor(reel.durationSeconds / 60)}:{String(Math.round(reel.durationSeconds % 60)).padStart(2, "0")}
                    </span>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <MaterialIcon name="play_arrow" size={42} weight={500} className="text-white opacity-85" />
                  </span>
                </a>
                <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
                  <span className="truncate text-[13px] font-extrabold">{reel.owner ? `@${reel.owner}` : "—"}</span>
                  <div className="grid grid-cols-3 gap-1.5 text-[12px] font-bold [font-variant-numeric:tabular-nums]">
                    {(
                      [
                        ["visibility", "Views", fmtN(reel.views)],
                        ["favorite", "Likes", fmtN(reel.likes)],
                        ["comment", "Comments", fmtN(reel.comments)],
                        ["send", "Shares", reel.shares == null ? "—" : fmtN(reel.shares)],
                        ["repeat", "Reposts", reel.reposts == null ? "—" : fmtN(reel.reposts)],
                        ["bookmark", "Saves", reel.saves == null ? "—" : fmtN(reel.saves)],
                      ] as const
                    ).map(([icon, label, value]) => (
                      <span key={label} title={label} className="flex items-center gap-1 rounded-md bg-[#F6F6F5] px-1.5 py-1">
                        <MaterialIcon name={icon} size={13} className="text-[#4a4a48]" />
                        {value}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11.5px] font-bold">
                    <span className="flex items-center gap-1 rounded-[10px] bg-[#EAF8D8] px-2 py-0.5 text-[#3a8a00]" title="Engagement rate (comments ÷ views)">
                      <MaterialIcon name="comment" size={13} /> Engagement {pct(reel.comments, reel.views)}
                    </span>
                    <span className="flex items-center gap-1 rounded-[10px] bg-[#FFE8D6] px-2 py-0.5 text-[#c25a00]" title="Share rate (reposts ÷ views)">
                      <MaterialIcon name="repeat" size={13} /> Share rate {reel.reposts != null ? pct(reel.reposts, reel.views) : "—"}
                    </span>
                  </div>
                  <button type="button" onClick={() => setAttachOpen(true)} className="flex items-center gap-1 text-[12px] font-bold text-[#4a4a48] hover:text-[#FF1F8F]">
                    <MaterialIcon name="swap_horiz" size={15} /> Change Reel
                  </button>
                  <div className="mt-auto grid grid-cols-2 gap-1.5">
                    <a
                      href={reel.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#E4E4E2] text-[12px] font-bold hover:border-[#0D0D0D]"
                    >
                      <MaterialIcon name="open_in_new" size={14} /> Instagram
                    </a>
                    <Link
                      href={`/analyze-reel/reel/${reel.id}`}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#E4E4E2] text-[12px] font-bold hover:border-[#0D0D0D]"
                    >
                      <MaterialIcon name="smart_display" size={14} /> Reel Detail
                    </Link>
                  </div>
                </div>
              </div>

              <div className={`${card} flex shrink-0 flex-col gap-3 p-4`}>
                <div className="flex items-center gap-2 text-[13px] font-extrabold">
                  <MaterialIcon name="graphic_eq" size={18} className="text-[#FF1F8F]" /> Transcript
                  {reel.transcript?.trim() && (
                    <span className="ml-auto text-[11.5px] font-semibold text-[#6b6b69]">{reel.transcript.trim().split(/\s+/).length} words</span>
                  )}
                </div>
                {reel.hook && (
                  <div className="rounded-md bg-[#FFF0F7] px-3 py-2">
                    <span className="text-[10.5px] font-extrabold tracking-wide text-[#D10A6E] uppercase">Hook</span>
                    <p className="mt-0.5 text-[13px] leading-[1.4] font-semibold">{reel.hook}</p>
                  </div>
                )}
                <p className="max-h-[360px] overflow-y-auto text-[13.5px] leading-[1.65] whitespace-pre-wrap text-[#2a2a28] [scrollbar-width:thin] max-md:max-h-[220px]">
                  {reel.transcript?.trim() || "Not transcribed yet."}
                </p>
                {reel.cta && (
                  <div className="rounded-md bg-[#F6F6F5] px-3 py-2">
                    <span className="text-[10.5px] font-extrabold tracking-wide text-[#4a4a48] uppercase">CTA</span>
                    <p className="mt-0.5 text-[13px] leading-[1.4] font-semibold">{reel.cta}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setAttachOpen(true)}
              className="flex flex-col items-center gap-2.5 rounded-lg border border-dashed border-[#BDBDBB] bg-white px-4 py-10 text-center transition-colors hover:border-[#FF1F8F] hover:bg-[#FFF8FB]"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-[#FFE3F0] text-[#FF1F8F]">
                <MaterialIcon name="add_link" size={24} />
              </span>
              <span className="text-[14.5px] font-extrabold">Attach Reel</span>
              <span className="text-xs font-medium text-[#4a4a48]">Pick a reel to study while you write.</span>
            </button>
          )}
        </aside>

        {/* Right: tabs + writing area */}
        <section className="flex min-w-0 flex-col gap-3.5">
          <div className="flex items-center gap-1.5 rounded-xl border border-[#F0F0F1] bg-white p-1.5 shadow-[0_4px_16px_rgba(13,13,13,0.06)]">
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-[15px] font-bold whitespace-nowrap transition-colors hover:bg-[#F6F6F5] max-md:text-[14px] md:flex-none md:px-6"
                  style={{ background: on ? "#F0F0F1" : undefined }}
                >
                  <MaterialIcon name={t.icon} size={20} className={on ? "text-[#FF1F8F]" : "text-[#4a4a48]"} />
                  {t.label}
                </button>
              );
            })}
            <span className="ml-auto hidden items-center gap-1 pr-3 text-[12.5px] font-semibold text-[#3a8a00] md:flex">
              {saved && (
                <>
                  <MaterialIcon name="check" size={15} /> Saved
                </>
              )}
            </span>
          </div>

          {tab === "hook" && (
            <div className="flex flex-col gap-3">
              <div className={`${card} flex flex-wrap items-center gap-2 p-2.5`}>
                <div className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-md border border-[#E4E4E2] px-2.5 focus-within:border-[#0D0D0D]">
                  <MaterialIcon name="search" size={17} className="text-[#4a4a48]" />
                  <input
                    value={hookQuery}
                    onChange={(e) => setHookQuery(e.target.value)}
                    placeholder="Search hooks or creators…"
                    autoComplete="off"
                    className="min-w-0 flex-1 border-0 bg-transparent text-[13px] font-medium outline-none"
                  />
                </div>
                <SortField compact value={hookSort} onChange={setHookSort} asc={hookAsc} onToggleAsc={() => setHookAsc((v) => !v)} />
                <div className="w-[130px]">
                  <FilterSelect compact label="Built for" icon="target" value={goalFilter} onChange={setGoalFilter} options={GOAL_OPTIONS} />
                </div>
                <ExcludeCreators compact variant="include" heightClass="h-9" className="w-[150px]" creators={hookCreators} value={hookCreator} onChange={setHookCreator} />
                <ExcludeCreators compact heightClass="h-9" className="w-[150px]" creators={hookCreators} value={hookExcluded} onChange={setHookExcluded} />
                <OutlierFilter metric={hookOutMetric} min={hookOutMin} onChange={(m, n) => { setHookOutMetric(m); setHookOutMin(n); }} />
                <div className="ml-auto flex items-center gap-2.5 text-[12px] font-semibold text-[#4a4a48]">
                  <span>
                    {hooks.length} {hooks.length === 1 ? "hook" : "hooks"}
                  </span>
                  <button
                    type="button"
                    disabled={!hookFiltersOn}
                    onClick={() => {
                      setHookQuery("");
                      setGoalFilter("all");
                      setHookCreator([]);
                      setHookSort("views");
                      setHookAsc(false);
                      setHookExcluded([]);
                      setHookOutMin(0);
                    }}
                    title="Clear filters"
                    aria-label="Clear filters"
                    className="flex h-8 items-center gap-1 rounded-md border border-[#E4E4E2] px-2 font-bold text-[#D10A6E] hover:border-[#D10A6E] disabled:text-[#9a9a98] disabled:hover:border-[#E4E4E2]"
                  >
                    <MaterialIcon name="filter_alt_off" size={15} /> Clear
                  </button>
                </div>
              </div>

              <div className={`${card} flex flex-col overflow-hidden`}>
                {hooks.length === 0 && <span className="px-5 py-8 text-center text-sm font-medium text-[#4a4a48]">No hooks match. Try another goal or search.</span>}
                {hooks.map((h, i) => (
                  <div key={h.id} className="flex items-center gap-3 border-b border-[#F0F0F1] px-4 py-3.5 last:border-b-0 md:px-5">
                    {h.pinned ? (
                      <span className="flex size-6 flex-none items-center justify-center rounded-full bg-[#FF1F8F] text-[#0D0D0D]" title="The hook from the reel you picked">
                        <MaterialIcon name="star" size={14} />
                      </span>
                    ) : (
                      <span className="flex size-6 flex-none items-center justify-center rounded-full bg-[#F0F0F1] text-[11px] font-extrabold">{hooks.slice(0, i + 1).filter((x) => !x.pinned).length}</span>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      {h.pinned && <span className="w-fit rounded-xl bg-[#FFE3F0] px-2 py-0.5 text-[10.5px] font-extrabold tracking-wide text-[#D10A6E] uppercase">From your picked reel</span>}
                      <span className="text-[14.5px] leading-[1.4] font-semibold">{h.hook}</span>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-bold text-[#4a4a48] [font-variant-numeric:tabular-nums]">
                        <span className="text-[#6b6b69]">{h.owner ? `@${h.owner}` : ""}</span>
                        {h.postedAt && (
                          <span className="flex items-center gap-1" title="Date posted">
                            <MaterialIcon name="event" size={13} /> {shortDate(h.postedAt)}
                          </span>
                        )}
                        <OutlierChip outlier={h.outlier} metric={hookOutMetric} />
                        {(
                          [
                            ["views", "visibility", fmtN(h.views)],
                            ["comments", "comment", fmtN(h.comments)],
                            ["shares", "send", h.shares == null ? "—" : fmtN(h.shares)],
                            ["saves", "bookmark", h.saves == null ? "—" : fmtN(h.saves)],
                            ["reposts", "repeat", h.reposts == null ? "—" : fmtN(h.reposts)],
                          ] as const
                        ).map(([k, icon, v]) => (
                          <span
                            key={k}
                            className="flex items-center gap-1 rounded-md px-1.5 py-0.5"
                            style={{ background: hookSort === k ? "#C6FF3D" : "transparent", color: "#0D0D0D" }}
                            title={k}
                          >
                            <MaterialIcon name={icon} size={13} /> {v}
                          </span>
                        ))}
                        {h.goals.map((g) => (
                          <span key={g} className="rounded-xl bg-[#FFE3F0] px-2 py-0.5 text-[10.5px] text-[#D10A6E] capitalize">
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setHook(h.hook);
                        saveScript(latest.current, h.hook);
                        setTab("script");
                      }}
                      title="Use this hook"
                      aria-label="Use this hook"
                      className="group relative flex size-9 flex-none items-center justify-center rounded-full bg-[#FF1F8F] text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F]"
                    >
                      <MaterialIcon name="add" size={20} weight={500} />
                      <span className="pointer-events-none absolute top-1/2 right-full mr-2 -translate-y-1/2 rounded-md bg-[#0D0D0D] px-2 py-1 text-[11.5px] font-bold whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100">Use this hook</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "script" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_280px] md:items-start">
            <div className="flex min-w-0 flex-col gap-3">
              <div className={`${card} relative overflow-hidden`}>
                {hook.trim() && (
                  <div className="border-b border-[#F4D3E4] bg-[#FFF6FA] px-4 py-3 md:px-6">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10.5px] font-extrabold tracking-wide text-[#D10A6E] uppercase">
                        <MaterialIcon name="phishing" size={13} /> Hook
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [hook, latest.current].filter((t) => t.trim()).join("\n\n");
                          setHook("");
                          setScript(next);
                          saveScript(next, "");
                        }}
                        title="Fold the hook back into the script"
                        className="ml-auto text-[11.5px] font-bold text-[#6b6b69] hover:text-[#D10A6E]"
                      >
                        Unmark
                      </button>
                    </div>
                    <AutoTextarea
                      value={hook}
                      onChange={setHook}
                      onBlur={() => saveScript(latest.current, hook)}
                      minRows={1}
                      className="w-full resize-none border-0 bg-transparent text-[15px] leading-[1.6] font-semibold outline-none"
                    />
                  </div>
                )}
                <div className="relative px-4 py-4 md:px-6">
                <AutoTextarea
                  value={script}
                  onChange={setScript}
                  onBlur={() => saveScript(script)}
                  minRows={14}
                  placeholder="Write your idea here. It becomes your script."
                  className="w-full resize-none border-0 bg-transparent pb-10 text-[15px] leading-[1.7] outline-none placeholder:text-[#9a9a98]"
                />
                <DictateButton
                  className="absolute right-3 bottom-3"
                  onText={(t) => {
                    const next = spoken(latest.current, t);
                    setScript(next);
                    saveScript(next);
                  }}
                />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-[#4a4a48]">{narration}</span>
                <button
                  type="button"
                  onClick={async () => {
                    if (await copyText(script)) {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    }
                  }}
                  className="flex h-9 items-center gap-1.5 rounded-md border border-[#E4E4E2] px-3.5 text-[12.5px] font-bold hover:border-[#0D0D0D]"
                >
                  <MaterialIcon name={copied ? "check" : "copy_all"} size={15} />
                  {copied ? "Copied" : "Copy Script"}
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#BDBDBB] bg-white px-4 py-3 text-[13.5px] font-medium text-[#9a9a98]">
                <MaterialIcon name="auto_awesome" size={17} />
                What changes would you like to make? (AI edits are coming with the script builder)
              </div>
            </div>
            <div className="max-md:order-first"><NotesLane ideaId={idea.id} initial={idea.notes} onSaved={touched} /></div>
            </div>
          )}
        </section>
      </div>
      {attachOpen && <AttachReelDialog onClose={() => setAttachOpen(false)} onPick={attach} currentId={reel?.id ?? null} />}
    </div>
  );
}
