"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { MaterialIcon } from "@/components/ui/material-icon";
import { AutoTextarea } from "@/components/auto-textarea";
import { DictateButton } from "@/components/dictate-button";
import { copyText } from "@/lib/copy-text";
import { saveScriptSections, setIdeaInspiration, updateJournalContent } from "@/app/idea/actions";
import { getReelTranscript, listAttachableReels, type AttachableReel } from "../actions";
import type { Idea } from "@/app/idea/idea-table";

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
};
export type VaultHook = {
  id: string;
  hook: string;
  owner: string | null;
  views: number;
  comments: number;
  shares: number | null;
  reposts: number | null;
  saves: number | null;
  goals: string[];
};

type Tab = "idea" | "hook" | "script";
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "idea", label: "Idea", icon: "lightbulb" },
  { key: "hook", label: "Hook", icon: "key" },
  { key: "script", label: "Script", icon: "edit_note" },
];

type HookSort = "views" | "comments" | "shares" | "saves" | "reposts" | "engagement";
const HOOK_SORTS: { key: HookSort; label: string; icon: string }[] = [
  { key: "views", label: "Most Views", icon: "visibility" },
  { key: "comments", label: "Most Comments", icon: "chat_bubble" },
  { key: "shares", label: "Most Shares", icon: "send" },
  { key: "saves", label: "Most Saves", icon: "bookmark" },
  { key: "reposts", label: "Most Reposts", icon: "repeat" },
  { key: "engagement", label: "Top Engagement", icon: "forum" },
];
const GOAL_FILTERS: { key: string; label: string; icon: string }[] = [
  { key: "all", label: "All Goals", icon: "flag" },
  { key: "views", label: "Views", icon: "visibility" },
  { key: "shares", label: "Shares", icon: "send" },
  { key: "comments", label: "Comments", icon: "chat_bubble" },
  { key: "saves", label: "Saves", icon: "bookmark" },
];

// A labelled dropdown with a leading icon - used by every filter bar on this page.
function FilterSelect({ icon, value, onChange, options, label }: { icon: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-extrabold tracking-wide text-[#6b6b69] uppercase">{label}</span>
      <span className="relative">
        <MaterialIcon name={icon} size={17} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[#4a4a48]" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full cursor-pointer appearance-none rounded-md border border-[#E4E4E2] bg-white pr-8 pl-9 text-[13px] font-semibold text-[#0D0D0D] outline-none hover:border-[#BDBDBB] focus:border-[#0D0D0D]"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <MaterialIcon name="expand_more" size={18} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[#4a4a48]" />
      </span>
    </label>
  );
}
const SORT_OPTIONS = [
  { value: "views", label: "Most views" },
  { value: "comments", label: "Most comments" },
  { value: "shares", label: "Most shares" },
  { value: "saves", label: "Most saves" },
  { value: "reposts", label: "Most reposts" },
  { value: "engagement", label: "Top engagement rate" },
];
const GOAL_OPTIONS = [
  { value: "all", label: "All goals" },
  { value: "views", label: "Views" },
  { value: "shares", label: "Shares" },
  { value: "comments", label: "Comments" },
  { value: "saves", label: "Saves" },
];
const MIN_VIEWS_OPTIONS = [
  { value: "0", label: "Any views" },
  { value: "10000", label: "10k+ views" },
  { value: "100000", label: "100k+ views" },
  { value: "1000000", label: "1M+ views" },
];
type Metrics = { views: number; comments: number; shares: number | null; saves: number | null; reposts: number | null };
function metricOf(h: Metrics, k: string) {
  return k === "views" ? h.views : k === "comments" ? h.comments : k === "shares" ? (h.shares ?? -1) : k === "saves" ? (h.saves ?? -1) : k === "reposts" ? (h.reposts ?? -1) : h.views > 0 ? h.comments / h.views : -1;
}

function AttachReelDialog({ onClose, onPick, currentId }: { onClose: () => void; onPick: (id: string | null) => void; currentId: string | null }) {
  const [reels, setReels] = useState<AttachableReel[] | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("views");
  const [goal, setGoal] = useState("all");
  const [creator, setCreator] = useState("all");
  const [minViews, setMinViews] = useState("0");
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
      .filter((r) => (goal === "all" || r.goals.includes(goal)) && (creator === "all" || r.owner === creator) && r.views >= Number(minViews) && (!query || r.text.toLowerCase().includes(query) || (r.owner ?? "").toLowerCase().includes(query)))
      .sort((a, b) => metricOf(b, sort) - metricOf(a, sort))
      .slice(0, 60);
  }, [reels, q, sort, goal, creator, minViews]);

  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(13,13,13,0.35)] p-4 backdrop-blur-[6px] max-md:p-2">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-full w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-[#F0F0F1] bg-white shadow-[0_24px_72px_rgba(13,13,13,0.28)]">
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <span className="text-[22px] font-extrabold tracking-[-0.01em]">Attach A Reel</span>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-md hover:bg-[#F0F0F1]">
            <MaterialIcon name="close" size={22} />
          </button>
        </div>
        <div className="flex flex-col gap-3 border-b border-[#F0F0F1] px-5 pb-4">
          <div className="flex h-10 items-center gap-2.5 rounded-md border border-[#E4E4E2] px-3 focus-within:border-[#0D0D0D]">
            <MaterialIcon name="search" size={19} className="text-[#4a4a48]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reels or creators…" autoComplete="off" className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <FilterSelect label="Sort by" icon="swap_vert" value={sort} onChange={setSort} options={SORT_OPTIONS} />
            <FilterSelect label="Built for" icon="flag" value={goal} onChange={setGoal} options={GOAL_OPTIONS} />
            <FilterSelect label="Creator" icon="person" value={creator} onChange={setCreator} options={[{ value: "all", label: "All creators" }, ...creators.map((c) => ({ value: c, label: "@" + c }))]} />
            <FilterSelect label="Views" icon="visibility" value={minViews} onChange={setMinViews} options={MIN_VIEWS_OPTIONS} />
          </div>
          <button
            type="button"
            disabled={!(q || goal !== "all" || creator !== "all" || minViews !== "0" || sort !== "views")}
            onClick={() => {
              setQ("");
              setGoal("all");
              setCreator("all");
              setMinViews("0");
              setSort("views");
            }}
            className="flex items-center gap-1 self-start rounded-md border border-[#E4E4E2] px-2.5 py-1 text-[12.5px] font-bold text-[#D10A6E] hover:border-[#D10A6E] disabled:text-[#9a9a98] disabled:hover:border-[#E4E4E2]"
          >
            <MaterialIcon name="filter_alt_off" size={15} /> Clear filters
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
                  <span className="flex items-center gap-1" title="Views"><MaterialIcon name="visibility" size={12} /> {fmtN(r.views)}</span>
                  <span className="flex items-center gap-1" title="Comments"><MaterialIcon name="chat_bubble" size={12} /> {fmtN(r.comments)}</span>
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
  const [script, setScript] = useState([idea.body, idea.cta].filter((t) => t.trim()).join("\n\n"));
  const [scriptId, setScriptId] = useState(idea.scriptId);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hookSort, setHookSort] = useState<string>("views");
  const [goalFilter, setGoalFilter] = useState("all");
  const [hookQuery, setHookQuery] = useState("");
  const [hookCreator, setHookCreator] = useState("all");
  const [hookMinViews, setHookMinViews] = useState("0");
  const [attachOpen, setAttachOpen] = useState(false);
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
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }
  function saveText() {
    if (text === idea.text) return;
    startTransition(async () => {
      await updateJournalContent(idea.id, text);
    });
  }
  // The hook and idea blocks are reference points, so only the script itself is counted and copied.
  const words = script.trim() ? script.trim().split(/s+/).length : 0;
  const sec = Math.round((words / 220) * 60);
  const narration = words === 0 ? "0 words" : `${words} words  •  ~${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} to narrate`;
  const spoken = (cur: string, t: string) => (cur.trim() ? cur.replace(/\s+$/, "") + " " + t : t);

  const hookCreators = useMemo(() => Array.from(new Set(vault.map((h) => h.owner).filter((o): o is string => !!o))).sort(), [vault]);
  const hooks = useMemo(() => {
    const q = hookQuery.trim().toLowerCase();
    return vault
      .filter(
        (h) =>
          (goalFilter === "all" || h.goals.includes(goalFilter)) &&
          (hookCreator === "all" || h.owner === hookCreator) &&
          h.views >= Number(hookMinViews) &&
          (!q || h.hook.toLowerCase().includes(q) || (h.owner ?? "").toLowerCase().includes(q)),
      )
      .sort((x, y) => metricOf(y, hookSort) - metricOf(x, hookSort))
      .slice(0, 40);
  }, [vault, hookSort, goalFilter, hookQuery, hookCreator, hookMinViews]);
  const hookFiltersOn = hookQuery !== "" || goalFilter !== "all" || hookCreator !== "all" || hookMinViews !== "0" || hookSort !== "views";

  const card = "rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]";

  return (
    <div className="flex flex-col gap-3.5 md:gap-5">
      <BackLink fallbackHref="/scripts" label="Back to Scripts" />
      <h1 className="line-clamp-2 text-[20px] leading-[1.15] font-black tracking-[-0.03em] md:text-[28px]" title={text}>
        {text || "Untitled idea"}
      </h1>

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
                        ["chat_bubble", "Comments", fmtN(reel.comments)],
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
                      <MaterialIcon name="forum" size={13} /> Engagement {pct(reel.comments, reel.views)}
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
                      onClick={() => {
                        try {
                          sessionStorage.setItem("vh-reopen-idea", idea.id);
                        } catch {}
                      }}
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

          {tab === "idea" && (
            <div className={`${card} p-4 md:p-5`}>
              <span className="text-xs font-bold tracking-wide text-[#4a4a48] uppercase">Your idea</span>
              <div className="mt-2">
                <AutoTextarea
                  value={text}
                  onChange={setText}
                  onBlur={saveText}
                  minRows={4}
                  className="w-full resize-none border-0 bg-transparent text-[16px] leading-[1.55] font-medium outline-none"
                />
              </div>
            </div>
          )}

          {tab === "hook" && (
            <div className="flex flex-col gap-3">
              <div className={`${card} flex flex-col gap-3 p-3.5`}>
                <div className="flex h-10 items-center gap-2.5 rounded-md border border-[#E4E4E2] px-3 focus-within:border-[#0D0D0D]">
                  <MaterialIcon name="search" size={19} className="text-[#4a4a48]" />
                  <input
                    value={hookQuery}
                    onChange={(e) => setHookQuery(e.target.value)}
                    placeholder="Search hooks or creators…"
                    autoComplete="off"
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                  <FilterSelect label="What worked" icon="swap_vert" value={hookSort} onChange={setHookSort} options={SORT_OPTIONS} />
                  <FilterSelect label="Built for" icon="flag" value={goalFilter} onChange={setGoalFilter} options={GOAL_OPTIONS} />
                  <FilterSelect label="Creator" icon="person" value={hookCreator} onChange={setHookCreator} options={[{ value: "all", label: "All creators" }, ...hookCreators.map((c) => ({ value: c, label: "@" + c }))]} />
                  <FilterSelect label="Views" icon="visibility" value={hookMinViews} onChange={setHookMinViews} options={MIN_VIEWS_OPTIONS} />
                </div>
                <div className="flex items-center justify-between text-[12.5px] font-semibold text-[#4a4a48]">
                  <span>
                    {hooks.length} {hooks.length === 1 ? "hook" : "hooks"}
                    {hookFiltersOn ? " match" : ""}
                  </span>
                  <button
                    type="button"
                    disabled={!hookFiltersOn}
                    onClick={() => {
                      setHookQuery("");
                      setGoalFilter("all");
                      setHookCreator("all");
                      setHookMinViews("0");
                      setHookSort("views");
                    }}
                    className="flex items-center gap-1 rounded-md border border-[#E4E4E2] px-2.5 py-1 font-bold text-[#D10A6E] hover:border-[#D10A6E] disabled:text-[#9a9a98] disabled:hover:border-[#E4E4E2]"
                  >
                    <MaterialIcon name="filter_alt_off" size={15} /> Clear filters
                  </button>
                </div>
              </div>

              <div className={`${card} flex flex-col overflow-hidden`}>
                {hooks.length === 0 && <span className="px-5 py-8 text-center text-sm font-medium text-[#4a4a48]">No hooks match. Try another goal or search.</span>}
                {hooks.map((h, i) => (
                  <div key={h.id} className="flex items-start gap-3 border-b border-[#F0F0F1] px-4 py-3.5 last:border-b-0 md:px-5">
                    <span className="flex size-6 flex-none items-center justify-center rounded-full bg-[#F0F0F1] text-[11px] font-extrabold">{i + 1}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <span className="text-[14.5px] leading-[1.4] font-semibold">{h.hook}</span>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-bold text-[#4a4a48] [font-variant-numeric:tabular-nums]">
                        <span className="text-[#6b6b69]">{h.owner ? `@${h.owner}` : ""}</span>
                        {(
                          [
                            ["views", "visibility", fmtN(h.views)],
                            ["comments", "chat_bubble", fmtN(h.comments)],
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
                      className="flex h-9 flex-none items-center gap-1.5 rounded-md bg-[#FF1F8F] px-3 text-[12.5px] font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F]"
                    >
                      <MaterialIcon name="add" size={16} weight={500} /> Use
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "script" && (
            <div className="flex flex-col gap-3">
              <div className={`${card} relative overflow-hidden`}>
                <div className="border-b border-[#E4E4E2] bg-[#F6F6F5] px-4 py-2.5 md:px-6">
                  <span className="flex items-center gap-1 text-[10.5px] font-extrabold tracking-wide text-[#4a4a48] uppercase">
                    <MaterialIcon name="lightbulb" size={13} /> Idea
                  </span>
                  <AutoTextarea
                    value={text}
                    onChange={setText}
                    onBlur={saveText}
                    minRows={1}
                    className="mt-0.5 max-h-[120px] w-full resize-none overflow-y-auto border-0 bg-transparent text-[13.5px] leading-[1.5] font-medium text-[#2a2a28] outline-none"
                  />
                </div>
                {hook.trim() && (
                  <div className="border-b border-[#F4D3E4] bg-[#FFF6FA] px-4 py-3 md:px-6">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10.5px] font-extrabold tracking-wide text-[#D10A6E] uppercase">
                        <MaterialIcon name="key" size={13} /> Hook
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
                  placeholder="Free write here. Don't worry about structure yet."
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
                  <MaterialIcon name={copied ? "check" : "content_copy"} size={15} />
                  {copied ? "Copied" : "Copy Script"}
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#BDBDBB] bg-white px-4 py-3 text-[13.5px] font-medium text-[#9a9a98]">
                <MaterialIcon name="auto_awesome" size={17} />
                What changes would you like to make? (AI edits are coming with the script builder)
              </div>
            </div>
          )}
        </section>
      </div>
      {attachOpen && <AttachReelDialog onClose={() => setAttachOpen(false)} onPick={attach} currentId={reel?.id ?? null} />}
    </div>
  );
}
