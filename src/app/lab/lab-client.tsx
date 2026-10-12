"use client";

import { useEffect, useRef, useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { DEFAULT_RULES, LAB_MODELS, type LabGoal, type LabModel } from "./models";
import { saveLabSetting } from "./settings-actions";

export type LabReel = { id: string; owner: string | null; views: number; comments: number; hook: string };

type Msg = { role: "user" | "assistant"; content: string; shown?: boolean; usage?: string; rulesUpdated?: boolean };

const fmtN = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n));
const field = "w-full rounded-md border border-[#E4E4E2] bg-white px-3.5 py-3 text-[16px] leading-[1.5] font-medium text-[#0D0D0D] outline-none focus:border-[#0D0D0D]";
const label = "text-[12.5px] font-extrabold tracking-wide text-[#6b6b69] uppercase";
const card = "flex flex-col gap-3 rounded-lg border border-[#F0F0F1] bg-white p-3.5 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:p-5";
const SCRIPT_RE = /(^|\n)HOOK\n[\s\S]*\nSCRIPT\n/;

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

function costText(modelId: LabModel, input: number, output: number) {
  const m = LAB_MODELS.find((x) => x.id === modelId) ?? LAB_MODELS[1];
  const cents = ((input * m.inPerM + output * m.outPerM) / 1_000_000) * 100;
  return `${m.label} · ${input.toLocaleString()} in / ${output.toLocaleString()} out · about ${cents < 1 ? cents.toFixed(2) : cents.toFixed(1)}¢`;
}

const TWEAKS = ["Make it shorter", "Make it sound more like me", "Punchier hook", "Remove anything that sounds like AI", "More specific"];

const RULES_BLOCK = /<<<RULES>>>\n?([\s\S]*?)\n?<<<END>>>/;

export function LabClient({ reels, initialRules, initialVoice }: { reels: LabReel[]; initialRules: string; initialVoice: string }) {
  const [reelId, setReelId] = useState(reels[0]?.id ?? "");
  const [goal, setGoal] = useState<LabGoal>("views");
  const [model, setModel] = useState<LabModel>("claude-sonnet-5-5");
  const [voice, setVoice] = useState(initialVoice);
  const [rules, setRules] = useState(initialRules.trim() ? initialRules : DEFAULT_RULES);
  const [rulesBefore, setRulesBefore] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const started = msgs.length > 0;
  const reel = reels.find((r) => r.id === reelId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [msgs]);

  // One turn: send the whole conversation, show the reply as it is written.
  async function turn(history: Msg[]) {
    setMsgs([...history, { role: "assistant", content: "" }]);
    setBusy(true);
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const stop = setTimeout(() => ctrl.abort(), 90_000);
    const setLast = (patch: Partial<Msg>) => setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, ...patch } : x)));
    try {
      const res = await fetch("/api/lab/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reelId, goal, model, voiceSamples: voice, rules, messages: history.map((m) => ({ role: m.role, content: m.content })) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error("The AI couldn't be reached. Try again.");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        const cut = acc.indexOf("\u0000");
        const text = cut >= 0 ? acc.slice(0, cut) : acc;
        const mark = text.indexOf("<<<");
        setLast({ content: (mark >= 0 ? text.slice(0, mark) : text).trimEnd() });
      }
      const cut = acc.indexOf("\u0000");
      const full = cut >= 0 ? acc.slice(0, cut) : acc;
      const block = full.match(RULES_BLOCK);
      if (block && block[1].trim()) {
        setRulesBefore(rules);
        setRules(block[1].trim());
        void saveLabSetting("rules", block[1].trim()).catch(() => {});
        setLast({ rulesUpdated: true });
      }
      if (cut >= 0) {
        const t = JSON.parse(acc.slice(cut + 1)) as { input?: number; output?: number; error?: string };
        if (t.error) throw new Error(t.error);
        setLast({ usage: costText(model, t.input ?? 0, t.output ?? 0) });
      }
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      setError(aborted ? "That took too long and stopped. Try again, or pick Sonnet or Haiku, which are faster." : e instanceof Error ? e.message : "Something went wrong.");
      // drop the empty reply so you can try again
      setMsgs((m) => (m.length && m[m.length - 1].role === "assistant" && !m[m.length - 1].content ? m.slice(0, -1) : m));
    } finally {
      clearTimeout(stop);
      setBusy(false);
    }
  }

  function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setInput("");
    void turn([...msgs, { role: "user", content: clean }]);
  }

  function startChat() {
    // the first message is hidden: it just tells the AI to begin
    void turn([{ role: "user", content: "Start. Study this reel and begin.", shown: false }]);
  }

  if (reels.length === 0) return <div className={card}>No analyzed reels yet. Analyze one first.</div>;

  const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
  const hasScript = Boolean(lastAssistant && SCRIPT_RE.test(lastAssistant.content));

  return (
    <div className="flex flex-col gap-4">
      {!started ? (
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
          <details className="rounded-md border border-[#F0F0F1]">
            <summary className="cursor-pointer px-3.5 py-3 text-[15px] font-bold">Your voice and script-writing instructions (optional)</summary>
            <div className="flex flex-col gap-3 p-3.5 pt-1">
              <label className="flex flex-col gap-1.5">
                <span className={label}>Your own scripts (paste 3 to 5 you like)</span>
                <textarea value={voice} onChange={(e) => setVoice(e.target.value)} onBlur={() => void saveLabSetting("voice", voice).catch(() => {})} rows={5} placeholder="Paste scripts or posts you wrote, one after another." className={field} data-own-size="" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="flex items-center justify-between">
                  <span className={label}>Script-writing instructions</span>
                  <button type="button" onClick={() => { setRules(DEFAULT_RULES); void saveLabSetting("rules", DEFAULT_RULES).catch(() => {}); }} className="text-[14px] font-bold underline">
                    Reset
                  </button>
                </span>
                <textarea value={rules} onChange={(e) => setRules(e.target.value)} onBlur={() => void saveLabSetting("rules", rules).catch(() => {})} rows={12} className={field} data-own-size="" />
              </label>
            </div>
          </details>
          <button type="button" disabled={busy} onClick={startChat} className="flex h-12 items-center justify-center gap-2 rounded-md bg-[#FF1F8F] px-5 text-[15px] font-extrabold text-[#0D0D0D] disabled:opacity-60">
            <MaterialIcon name="forum" size={22} /> Start Chat
          </button>
          {error && <span className="text-[14.5px] font-semibold text-[#D10A6E]">{error}</span>}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-[#EDEDEB] pb-2.5 text-[14px] font-semibold text-[#6b6b69]">
            <span className="min-w-0 truncate">
              @{reel?.owner ?? "?"} · {goal} · {LAB_MODELS.find((m) => m.id === model)?.label}
            </span>
            <button type="button" onClick={() => setShowRules((v) => !v)} aria-label="Script-writing instructions" title="Script-writing instructions" className="flex size-10 flex-none items-center justify-center rounded-md border border-[#E4E4E2] bg-white">
              <MaterialIcon name="tune" size={20} />
            </button>
            <button
              type="button"
              onClick={() => {
                abortRef.current?.abort();
                setMsgs([]);
                setError(null);
                setBusy(false);
              }}
              className="flex h-10 flex-none items-center gap-1.5 rounded-md border border-[#E4E4E2] bg-white px-3.5 text-[14px] font-bold text-[#0D0D0D]"
            >
              <MaterialIcon name="add" size={18} /> New Chat
            </button>
          </div>

          {showRules && (
            <div className="flex flex-col gap-2 rounded-lg border border-[#F0F0F1] bg-white p-3.5">
              <span className="text-[14px] font-bold text-[#4a4a48]">Script-writing instructions. The chat updates these as you give feedback.</span>
              <textarea value={rules} onChange={(e) => setRules(e.target.value)} onBlur={() => void saveLabSetting("rules", rules).catch(() => {})} rows={12} className={field} data-own-size="" />
            </div>
          )}

          <div className="flex flex-col gap-3">
            {msgs.map((m, i) =>
              m.role === "user" ? (
                m.shown === false ? null : (
                  <div key={i} className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[#0D0D0D] px-4 py-3 text-[16.5px] leading-[1.5] whitespace-pre-wrap text-white">
                    {m.content}
                  </div>
                )
              ) : (
                <div key={i} className="max-w-full px-0.5 py-1">
                  {m.content ? (
                    <div className="text-[16.5px] leading-[1.55] whitespace-pre-wrap">{m.content}</div>
                  ) : (
                    <span className="flex items-center gap-2 text-[15px] font-semibold text-[#6b6b69]">
                      <EqualizerIcon size={16} /> Thinking…
                    </span>
                  )}
                  {m.content && SCRIPT_RE.test(m.content) && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(m.content).then(() => {
                          setCopied(i);
                          setTimeout(() => setCopied(null), 1500);
                        });
                      }}
                      className="mt-3 flex h-11 items-center gap-1.5 rounded-md border border-[#E4E4E2] px-4 text-[14.5px] font-bold"
                    >
                      <MaterialIcon name={copied === i ? "check" : "copy_all"} size={19} /> {copied === i ? "Copied" : "Copy Script"}
                    </button>
                  )}
                  {m.rulesUpdated && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-[#EAF8D8] px-3 py-2 text-[14px] font-bold text-[#2a6a00]">
                      <span className="flex items-center gap-1.5">
                        <MaterialIcon name="check" size={18} /> Script-writing instructions updated
                      </span>
                      {rulesBefore != null && (
                        <button
                          type="button"
                          onClick={() => {
                            setRules(rulesBefore);
                            void saveLabSetting("rules", rulesBefore).catch(() => {});
                            setRulesBefore(null);
                            setMsgs((all) => all.map((x, k) => (k === i ? { ...x, rulesUpdated: false } : x)));
                          }}
                          className="h-9 rounded-md bg-white px-3 text-[13.5px] font-bold underline"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  )}
                  {m.usage && <div className="mt-2 text-[12.5px] font-semibold text-[#9a9a98]">{m.usage}</div>}
                </div>
              ),
            )}
            {error && <span className="text-[14.5px] font-semibold text-[#D10A6E]">{error}</span>}
            <div ref={endRef} />
          </div>

          {hasScript && !busy && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setInput("Here is my edited version:\n\n");
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
                className="h-11 rounded-full bg-[#0D0D0D] px-4 text-[14.5px] font-bold text-white"
              >
                I edited it
              </button>
              {TWEAKS.map((t) => (
                <button key={t} type="button" onClick={() => send(t)} className="h-11 rounded-full bg-[#F6F6F5] px-4 text-[14.5px] font-bold">
                  {t}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="sticky bottom-2 flex items-end gap-2 rounded-2xl border border-[#E4E4E2] bg-white p-2 shadow-[0_8px_24px_rgba(13,13,13,0.12)]"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 768px)").matches) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={busy ? "Wait for the reply…" : "Type your answer…"}
              className="max-h-40 min-h-12 flex-1 resize-none border-0 bg-transparent px-3 py-3 text-[16.5px] leading-[1.4] outline-none"
              data-own-size=""
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="flex size-12 flex-none items-center justify-center rounded-full bg-[#FF1F8F] text-[#0D0D0D] disabled:opacity-40">
              <MaterialIcon name="arrow_upward" size={24} weight={500} />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
