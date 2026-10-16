"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/material-icon";
import { EqualizerIcon } from "@/components/equalizer-icon";
import { DEFAULT_RULES, LAB_MODELS, type LabGoal, type LabModel } from "./models";
import { saveLabSetting } from "./settings-actions";
import { fmtN } from "@/lib/format";

export type LabReel = { id: string; owner: string | null; views: number; comments: number; hook: string };

type Msg = { role: "user" | "assistant"; content: string; raw?: string; usage?: string; rulesUpdated?: boolean };

const field = "w-full rounded-md border border-[#E4E4E2] bg-white px-3.5 py-3 text-[16px] leading-[1.5] font-medium text-[#0D0D0D] outline-none focus:border-[#0D0D0D]";
const label = "text-[12px] font-extrabold tracking-wide text-[#6b6b69] uppercase";
const SCRIPT_RE = /(^|\n)HOOK\n[\s\S]*\nSCRIPT\n/;
const RULES_BLOCK = /<<<RULES>>>\n?([\s\S]*?)\n?<<<END>>>/;
const TWEAKS = ["Make it shorter", "Make it sound more like me", "Punchier hook", "Remove anything that sounds like AI", "More specific"];

function costText(modelId: LabModel, input: number, output: number) {
  const m = LAB_MODELS.find((x) => x.id === modelId) ?? LAB_MODELS[1];
  const cents = ((input * m.inPerM + output * m.outPerM) / 1_000_000) * 100;
  return `${m.label} · ${input.toLocaleString()} in / ${output.toLocaleString()} out · about ${cents < 1 ? cents.toFixed(2) : cents.toFixed(1)}¢`;
}

export function LabClient({ reels, initialRules, initialVoice }: { reels: LabReel[]; initialRules: string; initialVoice: string }) {
  const [reelId, setReelId] = useState(reels[0]?.id ?? "");
  const [goal, setGoal] = useState<LabGoal>("views");
  const [model, setModel] = useState<LabModel>("claude-sonnet-5-5");
  const [voice, setVoice] = useState(initialVoice);
  const [rules, setRules] = useState(initialRules.trim() ? initialRules : DEFAULT_RULES);
  const [rulesBefore, setRulesBefore] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  // the visible area (it shrinks when the phone keyboard opens), so the chat box always stays in view
  const [view, setView] = useState<{ top: number; height: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const started = msgs.length > 0;
  const reel = reels.find((r) => r.id === reelId);

  // the whole screen is the chat: lock the page behind it and follow the keyboard
  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => setView({ top: vv?.offsetTop ?? 0, height: vv?.height ?? window.innerHeight });
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (started && el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, started, view?.height]);

  // the chat box is big and keeps growing as you type
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = Math.max(160, Math.round((view?.height ?? 700) * 0.45));
    el.style.height = Math.min(Math.max(el.scrollHeight, 96), max) + "px";
  }, [input, view?.height]);

  // One turn: send the whole conversation, show the reply as it is written.
  async function turn(history: Msg[]) {
    setMsgs([...history, { role: "assistant", content: "" }]);
    setBusy(true);
    setError(null);
    setShowSettings(false);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const stop = setTimeout(() => ctrl.abort(), 90_000);
    const setLast = (patch: Partial<Msg>) => setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, ...patch } : x)));
    try {
      const res = await fetch("/api/lab/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reelId, goal, model, voiceSamples: voice, rules, messages: history.map((m) => ({ role: m.role, content: m.raw ?? m.content })) }),
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
      setLast({ raw: full });
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

  if (reels.length === 0) return <div className="rounded-lg border border-[#F0F0F1] bg-white p-4">No analyzed reels yet. Analyze one first.</div>;

  const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
  const hasScript = Boolean(lastAssistant && SCRIPT_RE.test(lastAssistant.content));
  const pill = "h-9 rounded-full border border-[#E4E4E2] bg-white px-3 text-[13px] font-semibold text-[#0D0D0D] outline-none max-md:text-[13px]";

  return (
    <div className="fixed inset-x-0 z-[90] flex flex-col bg-[#FBFBFA]" style={{ top: view?.top ?? 0, height: view?.height ?? "100dvh" }}>
      {/* a slim top bar: small, the chat is what matters */}
      <div className="flex h-10 flex-none items-center gap-1 border-b border-[#EDEDEB] px-1.5">
        <Link href="/" aria-label="Back to Viral Heist" className="flex size-9 flex-none items-center justify-center rounded-full text-[#6b6b69]">
          <MaterialIcon name="arrow_back" size={20} />
        </Link>
        <button type="button" onClick={() => setShowSettings((v) => !v)} className="min-w-0 flex-1 truncate text-left text-[12px] font-semibold text-[#8a8a88] max-md:text-[12px]">
          @{reel?.owner ?? "?"} · {goal} · {LAB_MODELS.find((m) => m.id === model)?.label.split(" (")[0]}
        </button>
        <button type="button" onClick={() => setShowSettings((v) => !v)} aria-label="Settings" className="flex size-9 flex-none items-center justify-center rounded-full text-[#6b6b69]">
          <MaterialIcon name="tune" size={19} />
        </button>
        {started && (
          <button
            type="button"
            onClick={() => {
              abortRef.current?.abort();
              setMsgs([]);
              setError(null);
              setBusy(false);
              setShowSettings(false);
            }}
            aria-label="New chat"
            title="New chat"
            className="flex size-9 flex-none items-center justify-center rounded-full text-[#6b6b69]"
          >
            <MaterialIcon name="add" size={21} />
          </button>
        )}
      </div>

      {/* the conversation fills the screen */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {showSettings && (
          <div className="mb-3 flex flex-col gap-2.5 rounded-lg border border-[#F0F0F1] bg-white p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <select value={reelId} onChange={(e) => setReelId(e.target.value)} disabled={started} className={`${pill} min-w-0 max-w-full flex-1 basis-full`} aria-label="Reference reel">
                {reels.map((r) => (
                  <option key={r.id} value={r.id}>
                    @{r.owner ?? "?"} · {fmtN(r.views)} views · {r.hook}
                  </option>
                ))}
              </select>
              <div className="flex h-9 overflow-hidden rounded-full border border-[#E4E4E2] bg-white">
                {(["views", "comments"] as const).map((g) => (
                  <button key={g} type="button" disabled={started} onClick={() => setGoal(g)} className="px-3.5 text-[13px] font-bold capitalize max-md:text-[13px]" style={{ background: goal === g ? "#0D0D0D" : "#fff", color: goal === g ? "#fff" : "#0D0D0D" }}>
                    {g}
                  </button>
                ))}
              </div>
              <select value={model} onChange={(e) => setModel(e.target.value as LabModel)} className={pill} aria-label="AI model">
                {LAB_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <details className="rounded-md border border-[#F0F0F1]">
              <summary className="cursor-pointer px-3 py-2 text-[13px] font-bold text-[#4a4a48] max-md:text-[13px]">Instructions and your voice</summary>
              <div className="flex flex-col gap-3 p-3 pt-1">
                <label className="flex flex-col gap-1.5">
                  <span className="flex items-center justify-between">
                    <span className={label}>Instructions (the chat updates these)</span>
                    <button
                      type="button"
                      onClick={() => {
                        setRules(DEFAULT_RULES);
                        void saveLabSetting("rules", DEFAULT_RULES).catch(() => {});
                      }}
                      className="text-[13.5px] font-bold underline"
                    >
                      Reset
                    </button>
                  </span>
                  <textarea value={rules} onChange={(e) => setRules(e.target.value)} onBlur={() => void saveLabSetting("rules", rules).catch(() => {})} rows={10} className={field} data-own-size="" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={label}>Your own scripts (paste 3 to 5 you like)</span>
                  <textarea value={voice} onChange={(e) => setVoice(e.target.value)} onBlur={() => void saveLabSetting("voice", voice).catch(() => {})} rows={5} placeholder="Paste scripts or posts you wrote, one after another." className={field} data-own-size="" />
                </label>
              </div>
            </details>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[#F0F0F1] px-4 py-3 text-[16.5px] leading-[1.5] whitespace-pre-wrap">
                {m.content}
              </div>
            ) : (
              <div key={i} className="max-w-full px-0.5 py-1">
                {m.content ? (
                  <div className="text-[16.5px] leading-[1.6] whitespace-pre-wrap">{m.content}</div>
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
                    className="mt-3 flex h-11 items-center gap-1.5 rounded-full border border-[#E4E4E2] px-4 text-[14.5px] font-bold"
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
        </div>

        {hasScript && !busy && (
          <div className="mt-4 flex flex-wrap gap-2">
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
              <button key={t} type="button" onClick={() => send(t)} className="h-11 rounded-full bg-[#F0F0F1] px-4 text-[14.5px] font-bold">
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* the chat box: big, at the bottom, above the keyboard */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex-none border-t border-[#EDEDEB] bg-[#FBFBFA] px-2.5 pt-2 pb-[max(10px,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-end gap-2 rounded-3xl border border-[#D9D9D7] bg-white p-1.5">
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
            rows={3}
            placeholder={busy ? "Wait for the reply…" : "Message"}
            className="min-h-24 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-3 py-2.5 text-[17px] leading-[1.45] outline-none"
            data-own-size=""
          />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="mb-1 flex size-11 flex-none items-center justify-center rounded-full bg-[#FF1F8F] text-[#0D0D0D] disabled:opacity-40">
            <MaterialIcon name="arrow_upward" size={24} weight={500} />
          </button>
        </div>
      </form>
    </div>
  );
}
