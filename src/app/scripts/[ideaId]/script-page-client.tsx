"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { MaterialIcon } from "@/components/ui/material-icon";
import { AutoTextarea } from "@/components/auto-textarea";
import { DictateButton } from "@/components/dictate-button";
import { copyText } from "@/lib/copy-text";
import { saveScriptSections, updateJournalContent } from "@/app/idea/actions";
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

function fmtN(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
}
const pct = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(n / d >= 0.1 ? 1 : 2) + "%" : "—");

export function ScriptPageClient({ idea, reel, vault }: { idea: Idea; reel: ScriptReel | null; vault: VaultHook[] }) {
  const merged = [idea.hook, idea.body, idea.cta].filter((t) => t.trim()).join("\n\n");
  const [tab, setTab] = useState<Tab>("script");
  const [text, setText] = useState(idea.text);
  const [script, setScript] = useState(merged);
  const [scriptId, setScriptId] = useState(idea.scriptId);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hookSort, setHookSort] = useState<HookSort>("views");
  const [goalFilter, setGoalFilter] = useState("all");
  const [hookQuery, setHookQuery] = useState("");
  const [, startTransition] = useTransition();
  const latest = useRef(script);
  latest.current = script;

  function saveScript(value: string) {
    startTransition(async () => {
      const id = await saveScriptSections(idea.id, scriptId, { hook: "", body: value, cta: "" });
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
  const words = script.trim() ? script.trim().split(/\s+/).length : 0;
  const sec = Math.round((words / 220) * 60);
  const narration = words === 0 ? "0 words" : `${words} words  •  ~${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} to narrate`;
  const spoken = (cur: string, t: string) => (cur.trim() ? cur.replace(/\s+$/, "") + " " + t : t);

  const hooks = useMemo(() => {
    const metric = (h: VaultHook, k: HookSort) =>
      k === "views"
        ? h.views
        : k === "comments"
          ? h.comments
          : k === "shares"
            ? (h.shares ?? -1)
            : k === "saves"
              ? (h.saves ?? -1)
              : k === "reposts"
                ? (h.reposts ?? -1)
                : h.views > 0
                  ? h.comments / h.views
                  : -1;
    const q = hookQuery.trim().toLowerCase();
    return vault
      .filter((h) => (goalFilter === "all" || h.goals.includes(goalFilter)) && (!q || h.hook.toLowerCase().includes(q) || (h.owner ?? "").toLowerCase().includes(q)))
      .sort((a, b) => metric(b, hookSort) - metric(a, hookSort))
      .slice(0, 40);
  }, [vault, hookSort, goalFilter, hookQuery]);

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
              <div className={`${card} flex flex-col overflow-hidden max-md:flex-row`}>
                <a
                  href={reel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open on Instagram"
                  className="relative block aspect-[4/5] w-full bg-[#2b2b29] max-md:aspect-[3/4] max-md:w-[120px] max-md:flex-none"
                >
                  {reel.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={reel.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />
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

              <div className={`${card} flex flex-col gap-3 p-4`}>
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
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#BDBDBB] bg-white px-4 py-10 text-center">
              <MaterialIcon name="video_library" size={28} className="text-[#4a4a48]" />
              <span className="text-[13.5px] font-bold">No reel attached yet</span>
              <span className="text-xs font-medium text-[#4a4a48]">Use “Use In New Idea” on a reel to study it here while you write.</span>
            </div>
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
                <div>
                  <span className="text-[11px] font-extrabold tracking-wide text-[#6b6b69] uppercase">What worked</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {HOOK_SORTS.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setHookSort(o.key)}
                        className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-bold"
                        style={{ background: hookSort === o.key ? "#0D0D0D" : "#FFFFFF", color: hookSort === o.key ? "#FFFFFF" : "#0D0D0D", borderColor: hookSort === o.key ? "#0D0D0D" : "#E4E4E2" }}
                      >
                        <MaterialIcon name={o.icon} size={15} />
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-extrabold tracking-wide text-[#6b6b69] uppercase">Built for</span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {GOAL_FILTERS.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setGoalFilter(o.key)}
                        className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-bold"
                        style={{ background: goalFilter === o.key ? "#FFE3F0" : "#FFFFFF", color: goalFilter === o.key ? "#D10A6E" : "#0D0D0D", borderColor: goalFilter === o.key ? "#FFC2E0" : "#E4E4E2" }}
                      >
                        <MaterialIcon name={o.icon} size={15} />
                        {o.label}
                      </button>
                    ))}
                  </div>
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
                        const next = h.hook + (latest.current.trim() ? "\n\n" + latest.current : "");
                        setScript(next);
                        saveScript(next);
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
              <div className={`${card} relative px-4 py-4 md:px-6`}>
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
    </div>
  );
}
