"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/ui/page-shell";
import { JournalForm } from "./journal-form";
import { ScriptDialog } from "./script-dialog";

type Attachment = {
  id: string;
  fileUrl: string;
  fileType: string | null;
  fileName: string | null;
};

type FleshOutAnswer = { question: string; answer: string };

export type Idea = {
  id: string;
  text: string;
  createdAt: string;
  sourceReelId: string | null;
  attachments: Attachment[];
  scheduledDate: string | null;
  posted: boolean;
  postedAt: string | null;
  scripted: boolean;
  scriptId: string | null;
  scriptContent: string;
  frameworkName: string | null;
  fleshOutAnswers: FleshOutAnswer[] | null;
};

type Stage = "raw" | "scripted" | "sched" | "posted";

const STATUS: Record<Stage, { label: string; dot: string; bg: string; fg: string; ring?: boolean }> = {
  raw: { label: "New", dot: "#8a8a88", bg: "#E0E0DE", fg: "#0D0D0D" },
  scripted: { label: "Scripted", dot: "#FF1F8F", bg: "#FFD9EB", fg: "#0D0D0D" },
  sched: { label: "Scheduled", dot: "#0D0D0D", bg: "#FFFFFF", fg: "#0D0D0D", ring: true },
  posted: { label: "Posted", dot: "#C6FF3D", bg: "#0D0D0D", fg: "#F6F6F5" },
};

const TABS: { key: "all" | Stage; label: string }[] = [
  { key: "all", label: "All" },
  { key: "raw", label: "Raw" },
  { key: "scripted", label: "Scripted" },
  { key: "sched", label: "Scheduled" },
  { key: "posted", label: "Posted" },
];

function stageOf(idea: Idea): Stage {
  if (idea.posted) return "posted";
  if (idea.scheduledDate) return "sched";
  if (idea.scripted) return "scripted";
  return "raw";
}

function fmtDate(value: string) {
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  return d
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

function ideaFullText(text: string, framework: string | null, answers: FleshOutAnswer[] | null) {
  const parts: string[] = [];
  if (text) parts.push(text);
  if (answers && answers.length > 0) {
    if (framework) parts.push(`Framework used: ${framework}`);
    for (const a of answers) parts.push(`${a.question}\n${a.answer}`);
  }
  return parts.join("\n\n");
}

type SortKey = "created" | "idea" | "status" | "sched" | "posted";

export function IdeaTable({ initial }: { initial: Idea[] }) {
  const [ideas, setIdeas] = useState(initial);
  const [filter, setFilter] = useState<"all" | Stage>("all");
  const [query] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "created", dir: -1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function updateIdea(id: string, patch: Partial<Idea>) {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    return ideas.filter((idea) => {
      if (filter !== "all" && stageOf(idea) !== filter) return false;
      if (q && !idea.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ideas, filter, q]);

  const sorted = useMemo(() => {
    const rank: Record<Stage, number> = { raw: 0, scripted: 1, sched: 2, posted: 3 };
    const val = (idea: Idea) => {
      switch (sort.key) {
        case "idea":
          return idea.text.toLowerCase();
        case "status":
          return rank[stageOf(idea)];
        case "sched":
          return idea.scheduledDate ?? "";
        case "posted":
          return idea.postedAt ?? "";
        default:
          return idea.createdAt;
      }
    };
    const emptyLast = sort.key === "sched" || sort.key === "posted";
    return [...filtered].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (emptyLast) {
        if (!x && y) return 1;
        if (x && !y) return -1;
      }
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [filtered, sort]);

  function headerProps(key: SortKey) {
    const active = sort.key === key;
    return {
      active,
      arrow: active ? (sort.dir === 1 ? "↑" : "↓") : "↕",
      onClick: () =>
        setSort(active ? { key, dir: (sort.dir * -1) as 1 | -1 } : { key, dir: key === "idea" || key === "status" ? 1 : -1 }),
    };
  }

  const selected = ideas.find((i) => i.id === selectedId) ?? null;

  const counts = useMemo(() => {
    const c: Record<"all" | Stage, number> = { all: ideas.length, raw: 0, scripted: 0, sched: 0, posted: 0 };
    for (const idea of ideas) c[stageOf(idea)]++;
    return c;
  }, [ideas]);

  const hIdea = headerProps("idea");
  const hStatus = headerProps("status");
  const hSched = headerProps("sched");
  const hPosted = headerProps("posted");

  return (
    <PageShell>
      <div>
        <h1 className="text-[64px] leading-[0.95] font-black tracking-[-0.04em]">
          Ideas
          <span className="ml-1 inline-block size-3 rounded-full bg-[#C6FF3D] align-baseline" />
        </h1>
        <p className="mt-2 text-[15px] font-medium text-[#4a4a48]">
          Capture now. Decide later.
        </p>
      </div>

      <JournalForm
        onCreated={(entry) => {
          setIdeas((prev) => [
            {
              id: entry.id,
              text: entry.text,
              createdAt: entry.createdAt,
              sourceReelId: null,
              attachments: entry.attachments.map((a) => ({
                id: a.url,
                fileUrl: a.url,
                fileType: a.type,
                fileName: a.name,
              })),
              scheduledDate: null,
              posted: false,
              postedAt: null,
              scripted: false,
              scriptId: null,
              scriptContent: "",
              frameworkName: null,
              fleshOutAnswers: null,
            },
            ...prev,
          ]);
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between pb-3">
          <div className="flex gap-1">
            {TABS.map((t) => {
              const active = filter === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFilter(t.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-[12.5px] font-bold",
                    active ? "bg-[#0D0D0D] text-[#D4D4D2]" : "text-[#0D0D0D] hover:bg-[#F6F6F5]",
                  )}
                >
                  <span>{t.label}</span>
                  <span className="opacity-60">{counts[t.key]}</span>
                </button>
              );
            })}
          </div>
          <span className="text-[13px] font-semibold text-[#4a4a48]">
            {sorted.length} {sorted.length === 1 ? "idea" : "ideas"}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[minmax(0,1fr)_130px_130px_120px] gap-5 border-t-2 border-[#0D0D0D] border-b border-[#CFCFCD] px-3.5 py-2.5 text-xs font-bold text-[#4a4a48]">
              <button
                onClick={hIdea.onClick}
                className={cn("flex items-center gap-1.5 whitespace-nowrap hover:text-[#FF1F8F]", hIdea.active && "text-[#0D0D0D]")}
              >
                <span>Idea</span>
                <span>{hIdea.arrow}</span>
              </button>
              <button
                onClick={hStatus.onClick}
                className={cn("flex items-center gap-1.5 whitespace-nowrap hover:text-[#FF1F8F]", hStatus.active && "text-[#0D0D0D]")}
              >
                <span>Status</span>
                <span>{hStatus.arrow}</span>
              </button>
              <button
                onClick={hSched.onClick}
                className={cn("flex items-center gap-1.5 whitespace-nowrap hover:text-[#FF1F8F]", hSched.active && "text-[#0D0D0D]")}
              >
                <span>Scheduled date</span>
                <span>{hSched.arrow}</span>
              </button>
              <button
                onClick={hPosted.onClick}
                className={cn("flex items-center gap-1.5 whitespace-nowrap hover:text-[#FF1F8F]", hPosted.active && "text-[#0D0D0D]")}
              >
                <span>Posted date</span>
                <span>{hPosted.arrow}</span>
              </button>
            </div>

            {sorted.map((idea) => {
            const stage = stageOf(idea);
            const s = STATUS[stage];
            return (
              <div
                key={idea.id}
                onClick={() => setSelectedId(idea.id)}
                className="grid cursor-pointer grid-cols-[minmax(0,1fr)_130px_130px_120px] items-center gap-5 border-b border-[#D9D9D7] px-3.5 py-3 hover:bg-[#F6F6F5]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="truncate text-[15px] font-medium">
                    {idea.text || "(no text)"}
                  </span>
                  {idea.sourceReelId && (
                    <Link
                      href={`/research/reel/${idea.sourceReelId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 text-[11px] font-bold text-[#FF1F8F] hover:underline"
                    >
                      Reel ↗
                    </Link>
                  )}
                  {idea.attachments.length > 0 && (
                    <span className="shrink-0 text-[11px] font-semibold text-[#4a4a48]">
                      {idea.attachments.length} file{idea.attachments.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <span
                  className="flex items-center gap-1.5 justify-self-start rounded-[12px] py-1 pr-2.5 pl-2 text-xs font-bold whitespace-nowrap"
                  style={{
                    background: s.bg,
                    color: s.fg,
                    boxShadow: s.ring ? "inset 0 0 0 1.5px #0D0D0D" : "none",
                  }}
                >
                  <span className="size-1.5 rounded-full" style={{ background: s.dot }} />
                  {s.label}
                </span>
                <span className="text-[13px] font-semibold whitespace-nowrap text-[#4a4a48]">
                  {idea.scheduledDate ? fmtDate(idea.scheduledDate) : "—"}
                </span>
                <span className="text-[13px] font-semibold whitespace-nowrap text-[#4a4a48]">
                  {idea.posted && idea.postedAt ? fmtDate(idea.postedAt) : "—"}
                </span>
              </div>
            );
          })}
            {sorted.length === 0 && (
              <div className="px-3.5 py-8 font-semibold text-[#4a4a48]">Nothing matches.</div>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <ScriptDialog
          entryId={selected.id}
          ideaText={selected.text}
          scriptId={selected.scriptId}
          scriptContent={selected.scriptContent}
          scheduledDate={selected.scheduledDate}
          scripted={selected.scripted}
          posted={selected.posted}
          attachments={selected.attachments}
          brandContent={ideaFullText(selected.text, selected.frameworkName, selected.fleshOutAnswers)}
          open={selectedId != null}
          onOpenChange={(open) => !open && setSelectedId(null)}
          onIdeaTextSaved={(text) => updateIdea(selected.id, { text })}
          onScheduledDateSaved={(scheduledDate) => updateIdea(selected.id, { scheduledDate })}
          onScriptedSaved={(scripted) => updateIdea(selected.id, { scripted })}
          onPostedSaved={(posted) =>
            updateIdea(selected.id, { posted, postedAt: posted ? new Date().toISOString() : null })
          }
        />
      )}
    </PageShell>
  );
}
