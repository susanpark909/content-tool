"use client";

import { useRef, useState, useTransition } from "react";
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
export type VaultHook = { id: string; hook: string; owner: string | null; views: number };

type Tab = "idea" | "analysis" | "hook" | "script";
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "idea", label: "Idea", icon: "lightbulb" },
  { key: "analysis", label: "Reel Analysis", icon: "science" },
  { key: "hook", label: "Hook", icon: "key" },
  { key: "script", label: "Script", icon: "edit_note" },
];

function fmtN(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
}
const pct = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(d > 0 && n / d >= 0.1 ? 1 : 2) + "%" : "—");

export function ScriptPageClient({ idea, reel, vault }: { idea: Idea; reel: ScriptReel | null; vault: VaultHook[] }) {
  const merged = [idea.hook, idea.body, idea.cta].filter((t) => t.trim()).join("\n\n");
  const [tab, setTab] = useState<Tab>("script");
  const [text, setText] = useState(idea.text);
  const [script, setScript] = useState(merged);
  const [scriptId, setScriptId] = useState(idea.scriptId);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
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

  return (
    <div className="flex flex-col gap-3.5 md:gap-5">
      <BackLink fallbackHref="/idea" label="Back to Ideas" />
      <div>
        <h1 className="line-clamp-2 text-[20px] leading-[1.15] font-black tracking-[-0.03em] md:text-[28px]" title={text}>{text || "Untitled idea"}</h1>
        <p className="mt-1 text-[13.5px] font-medium text-[#4a4a48] md:text-[15px]">
          Write it here. Your idea and the reel you&apos;re studying stay side by side.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[300px_minmax(0,1fr)] md:gap-6 md:items-start">
        {/* Left: the reel you're studying */}
        <aside className="flex flex-col gap-2.5 md:sticky md:top-6">
          {reel ? (
            <div className="flex flex-col overflow-hidden rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)] max-md:flex-row">
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
                <div className="mt-auto flex flex-col gap-1.5">
                  <a
                    href={reel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#E4E4E2] text-[12.5px] font-bold hover:border-[#0D0D0D]"
                  >
                    <MaterialIcon name="open_in_new" size={15} /> Open On Instagram
                  </a>
                  <Link
                    href={`/analyze-reel/reel/${reel.id}`}
                    onClick={() => {
                      try {
                        sessionStorage.setItem("vh-reopen-idea", idea.id);
                      } catch {}
                    }}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#E4E4E2] text-[12.5px] font-bold hover:border-[#0D0D0D]"
                  >
                    <MaterialIcon name="smart_display" size={15} /> Reel Detail
                  </Link>
                </div>
              </div>
            </div>
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
          <div className="flex gap-1.5 overflow-x-auto rounded-xl border border-[#F0F0F1] bg-white p-1.5 shadow-[0_4px_16px_rgba(13,13,13,0.06)] [scrollbar-width:none]">
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className="flex h-11 flex-none items-center gap-2 rounded-lg px-5 text-[15px] font-bold whitespace-nowrap hover:bg-[#F6F6F5] max-md:px-4 max-md:text-[14px]"
                  style={{ background: on ? "#F0F0F1" : undefined }}
                >
                  <MaterialIcon name={t.icon} size={20} />
                  {t.label}
                </button>
              );
            })}
            <span className="ml-auto flex items-center pr-2 text-xs font-semibold text-[#4a4a48]">{saved ? "Saved ✓" : ""}</span>
          </div>

          {tab === "idea" && (
            <div className="relative rounded-lg border border-[#F0F0F1] bg-white p-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:p-5">
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

          {tab === "analysis" && (
            <div className="flex flex-col gap-4 rounded-lg border border-[#F0F0F1] bg-white p-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:p-5">
              {!reel ? (
                <span className="text-sm font-medium text-[#4a4a48]">Attach a reel to see its analysis here.</span>
              ) : (
                <>
                  <div>
                    <span className="text-xs font-bold tracking-wide text-[#4a4a48] uppercase">Hook</span>
                    <p className="mt-1 text-[15px] leading-[1.5] font-semibold">{reel.hook || "No hook found yet."}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold tracking-wide text-[#4a4a48] uppercase">CTA</span>
                    <p className="mt-1 text-[15px] leading-[1.5] font-semibold">{reel.cta || "No CTA in this reel."}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold tracking-wide text-[#4a4a48] uppercase">Transcript</span>
                    <p className="mt-1 max-h-[360px] overflow-y-auto text-[14.5px] leading-[1.65] whitespace-pre-wrap">
                      {reel.transcript?.trim() || "Not transcribed yet."}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-[#9a9a98]">Idea analysis, storytelling format and visual layout are coming next.</span>
                </>
              )}
            </div>
          )}

          {tab === "hook" && (
            <div className="flex flex-col rounded-lg border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
              <div className="px-4 pt-4 pb-2 text-xs font-bold tracking-wide text-[#4a4a48] uppercase md:px-5">From your Hook Vault</div>
              {vault.length === 0 && <span className="px-5 py-6 text-sm font-medium text-[#4a4a48]">No saved hooks yet.</span>}
              {vault.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    const next = h.hook + (latest.current.trim() ? "\n\n" + latest.current : "");
                    setScript(next);
                    saveScript(next);
                    setTab("script");
                  }}
                  className="flex items-start gap-3 border-t border-[#F0F0F1] px-4 py-3 text-left hover:bg-[#FBFBFA] md:px-5"
                >
                  <span className="min-w-0 flex-1 text-[14px] leading-[1.4] font-semibold">{h.hook}</span>
                  <span className="flex-none text-xs font-semibold whitespace-nowrap text-[#4a4a48]">
                    {h.owner ? `@${h.owner} · ` : ""}
                    {fmtN(h.views)}
                  </span>
                </button>
              ))}
              <div className="border-t border-[#F0F0F1] px-4 py-3 text-xs font-medium text-[#9a9a98] md:px-5">
                Tap a hook to put it at the top of your script. Hook formulas and “write hooks in my voice” come next.
              </div>
            </div>
          )}

          {tab === "script" && (
            <div className="flex flex-col gap-3">
              <div className="relative rounded-lg border border-[#F0F0F1] bg-white px-4 py-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:px-6">
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
                  className="flex h-8 items-center gap-1.5 rounded-md border border-[#E4E4E2] px-3 text-[12.5px] font-bold hover:border-[#0D0D0D]"
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
