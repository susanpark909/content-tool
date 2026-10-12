"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { DEFAULT_RULES, LAB_MODELS, type LabGoal, type LabModel } from "./models";
import { studyReel, writeScript, type LabRun, type Study } from "./actions";

export type LabReel = { id: string; owner: string | null; views: number; comments: number; hook: string };

const fmtN = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n));
const field = "w-full rounded-md border border-[#E4E4E2] bg-white px-3.5 py-3 text-[16px] leading-[1.5] font-medium text-[#0D0D0D] outline-none focus:border-[#0D0D0D]";
const label = "text-[12.5px] font-extrabold tracking-wide text-[#6b6b69] uppercase";
const card = "flex flex-col gap-3 rounded-lg border border-[#F0F0F1] bg-white p-3.5 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:p-5";
const btn = "flex h-12 items-center justify-center gap-2 rounded-md px-5 text-[15px] font-extrabold disabled:opacity-60";

// things remembered in this browser, so a refresh doesn't lose your voice samples or rules
function useSaved(key: string, initial: string) {
  const [v, setV] = useState(initial);
  useEffect(() => {
    try {
      const s = localStorage.getItem("vh-lab-" + key);
      if (s != null) setV(s);
    } catch {}
  }, [key]);
  return [
    v,
    (n: string) => {
      setV(n);
      try {
        localStorage.setItem("vh-lab-" + key, n);
      } catch {}
    },
  ] as const;
}

function Usage({ run }: { run: LabRun["usage"] | null }) {
  if (!run) return null;
  return (
    <span className="text-[13px] font-semibold text-[#6b6b69]">
      {run.model} · {run.input.toLocaleString()} in / {run.output.toLocaleString()} out · about {run.cents < 1 ? run.cents.toFixed(2) : run.cents.toFixed(1)}¢
    </span>
  );
}

export function LabClient({ reels }: { reels: LabReel[] }) {
  const [reelId, setReelId] = useState(reels[0]?.id ?? "");
  const [goal, setGoal] = useState<LabGoal>("views");
  const [model, setModel] = useState<LabModel>("claude-sonnet-5-5");
  const [idea, setIdea] = useSaved("idea", "");
  const [voice, setVoice] = useSaved("voice", "");
  const [rules, setRules] = useSaved("rules2", DEFAULT_RULES);
  const [busy, setBusy] = useState<null | "script" | "study" | "final" | "tweak">(null);
  const [error, setError] = useState<string | null>(null);
  const [script, setScript] = useState<string | null>(null);
  const [scriptUsage, setScriptUsage] = useState<LabRun["usage"] | null>(null);
  const [study, setStudy] = useState<Study | null>(null);
  const [studyUsage, setStudyUsage] = useState<LabRun["usage"] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const base = { reelId, goal, model, idea, voiceSamples: voice, rules };
  const frameworkText = study
    ? [
        `WHAT THIS REEL REALLY IS: ${study.reallyIs}`,
        `HOOK TEMPLATE: ${study.hook.template}\nWHY THE HOOK WORKED: ${study.hook.why.join(" ")}`,
        `BODY BEATS:\n${study.body.beats.map((b, i) => `${i + 1}. ${b.beat}: ${b.job} Template: ${b.template}`).join("\n")}`,
        `WHY THE BODY WORKED (keep these mechanics alive without copying the words): ${study.body.why.join(" ")}`,
      ].join("\n\n")
    : undefined;
  const answersText = study ? study.questions.map((q, i) => (answers[i]?.trim() ? `Q: ${q}\nA: ${answers[i].trim()}` : "")).filter(Boolean).join("\n\n") : undefined;

  // Never leave the button stuck: if the AI takes too long or the connection drops, say so and let you try again.
  async function guarded<T>(work: Promise<T>): Promise<T | { error: string }> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<{ error: string }>((resolve) => {
      timer = setTimeout(() => resolve({ error: "That took too long and stopped. Try again, or pick Sonnet or Haiku, which are faster." }), 85_000);
    });
    try {
      return await Promise.race([work, limit]);
    } catch {
      return { error: "The connection dropped before the AI answered. Try again." };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function runScript(kind: "script" | "final", extra?: { tweak: { previous: string; instruction: string } }) {
    setBusy(extra ? "tweak" : kind);
    setError(null);
    const res = await guarded(writeScript({ ...base, ...(kind === "final" ? { framework: frameworkText, answers: answersText } : {}), ...(extra ?? {}) }));
    if ("error" in res) setError(res.error);
    else {
      setScript(res.script);
      setScriptUsage(res.usage);
    }
    setBusy(null);
  }
  async function runStudy() {
    setBusy("study");
    setError(null);
    const res = await guarded(studyReel({ reelId, goal, model, idea }));
    if ("error" in res) setError(res.error);
    else {
      setStudy(res.study);
      setStudyUsage(res.usage);
      setAnswers(res.study.questions.map(() => ""));
    }
    setBusy(null);
  }

  if (reels.length === 0) return <div className={card}>No analyzed reels yet. Analyze one first.</div>;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className={card}>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className={label}>Reference reel</span>
            <select value={reelId} onChange={(e) => setReelId(e.target.value)} className={field + " h-12 py-0"}>
              {reels.map((r) => (
                <option key={r.id} value={r.id}>
                  @{r.owner ?? "?"} · {fmtN(r.views)} views · {r.hook}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1.5">
            <span className={label}>Goal</span>
            <div className="flex h-12 overflow-hidden rounded-md border border-[#E4E4E2]">
              {(["views", "comments"] as const).map((g) => (
                <button key={g} type="button" onClick={() => setGoal(g)} className="flex-1 px-5 text-[15px] font-bold capitalize" style={{ background: goal === g ? "#0D0D0D" : "#fff", color: goal === g ? "#fff" : "#0D0D0D" }}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={label}>AI model</span>
            <select value={model} onChange={(e) => setModel(e.target.value as LabModel)} className={field + " h-12 py-0"}>
              {LAB_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Your idea or topic (optional)</span>
          <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={3} placeholder="What do you want this reel to be about?" className={field} data-own-size="" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Your own scripts (paste 3 to 5 you like, so it learns your voice)</span>
          <textarea value={voice} onChange={(e) => setVoice(e.target.value)} rows={6} placeholder="Paste scripts or posts you wrote, one after another." className={field} data-own-size="" />
        </label>
        <div className="flex flex-col gap-2 md:flex-row">
          <button type="button" disabled={busy != null} onClick={runStudy} className={`${btn} bg-[#FF1F8F] text-[#0D0D0D] md:flex-1`}>
            {busy === "study" ? <EqualizerIcon size={16} /> : <MaterialIcon name="psychology" size={22} />}
            {busy === "study" ? "Studying…" : "Study This Reel"}
          </button>
          <button type="button" disabled={busy != null} onClick={() => runScript("script")} className={`${btn} border border-[#0D0D0D] bg-white text-[#0D0D0D] md:flex-1`}>
            {busy === "script" ? <EqualizerIcon size={16} /> : <MaterialIcon name="edit_note" size={22} />}
            {busy === "script" ? "Writing…" : "Skip To A Quick Script"}
          </button>
        </div>
        {error && <span className="text-[14.5px] font-semibold text-[#D10A6E]">{error}</span>}
      </div>

      {study && (
        <div className={card}>
          <span className="text-[20px] font-black tracking-[-0.02em]">What This Reel Really Is</span>
          <p className="text-[17px] leading-[1.55] font-semibold">{study.reallyIs}</p>

          <span className="mt-2 text-[20px] font-black tracking-[-0.02em]">Why The Hook Worked</span>
          <ul className="flex flex-col gap-2 text-[16px] leading-[1.5]">
            {study.hook.why.map((w, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-2 size-1.5 flex-none rounded-full bg-[#FF1F8F]" />
                {w}
              </li>
            ))}
          </ul>
          <div className="rounded-md border border-[#F0F0F1] bg-[#FBFBFA] p-3">
            <div className="text-[13px] font-extrabold tracking-wide text-[#6b6b69] uppercase">Hook template</div>
            <div className="mt-1 text-[16px] leading-[1.5] font-semibold">{study.hook.template}</div>
          </div>

          <span className="mt-2 text-[20px] font-black tracking-[-0.02em]">Why The Body Worked</span>
          <ul className="flex flex-col gap-2 text-[16px] leading-[1.5]">
            {study.body.why.map((w, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-2 size-1.5 flex-none rounded-full bg-[#FF1F8F]" />
                {w}
              </li>
            ))}
          </ul>
          <div className="text-[13px] font-extrabold tracking-wide text-[#6b6b69] uppercase">Body template</div>
          <ol className="flex flex-col gap-2.5">
            {study.body.beats.map((b, i) => (
              <li key={i} className="rounded-md border border-[#F0F0F1] bg-[#FBFBFA] p-3">
                <div className="text-[16px] font-extrabold">
                  {i + 1}. {b.beat}
                </div>
                <div className="text-[15px] text-[#4a4a48]">{b.job}</div>
                <div className="mt-1 text-[15.5px] font-semibold">{b.template}</div>
              </li>
            ))}
          </ol>

          <span className="mt-1 text-[20px] font-black tracking-[-0.02em]">Tell It Your Story</span>
          <div className="flex flex-col gap-3">
            {study.questions.map((q, i) => (
              <label key={i} className="flex flex-col gap-1.5">
                <span className="text-[15.5px] font-bold">{q}</span>
                <textarea value={answers[i] ?? ""} onChange={(e) => setAnswers((a) => a.map((x, k) => (k === i ? e.target.value : x)))} rows={2} className={field} data-own-size="" />
              </label>
            ))}
          </div>
          <button type="button" disabled={busy != null} onClick={() => runScript("final")} className={`${btn} bg-[#FF1F8F] text-[#0D0D0D]`}>
            {busy === "final" ? <EqualizerIcon size={16} /> : <MaterialIcon name="edit_note" size={22} />}
            {busy === "final" ? "Writing…" : "Write It From My Answers"}
          </button>
          <Usage run={studyUsage} />
        </div>
      )}

      {script && (
        <div className={card}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[20px] font-black tracking-[-0.02em]">Your Script</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(script).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="flex h-11 items-center gap-1.5 rounded-md border border-[#E4E4E2] px-4 text-[14.5px] font-bold"
            >
              <MaterialIcon name={copied ? "check" : "copy_all"} size={19} /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="text-[17px] leading-[1.6] whitespace-pre-wrap">{script}</div>
          <Usage run={scriptUsage} />
          <div className="flex flex-wrap gap-2 pt-1">
            {["Make it shorter", "Make it sound more like me", "Punchier hook", "Remove anything that sounds like AI", "More specific, less general"].map((t) => (
              <button key={t} type="button" disabled={busy != null} onClick={() => runScript("script", { tweak: { previous: script, instruction: t } })} className="h-11 rounded-full bg-[#F6F6F5] px-4 text-[14.5px] font-bold disabled:opacity-60">
                {busy === "tweak" ? "Working…" : t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[20px] font-black tracking-[-0.02em]">Writing Rules</span>
          <button type="button" onClick={() => setRules(DEFAULT_RULES)} className="text-[14.5px] font-bold underline">
            Reset
          </button>
        </div>
        <span className="text-[14.5px] text-[#4a4a48]">This is what the AI is told about how to write. Change it, run again, and see what gets better.</span>
        <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={12} className={field} data-own-size="" />
      </div>
    </div>
  );
}
