"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/ui/page-shell";
import { MaterialIcon } from "@/components/ui/material-icon";
import { JournalForm } from "./journal-form";
import { IdeaPanel } from "./idea-panel";
import { deleteIdea } from "./actions";

const GOAL_META: Record<"views" | "comments" | "shares", { label: string; icon: string }> = {
  views: { label: "Views", icon: "visibility" },
  comments: { label: "Comments", icon: "chat_bubble" },
  shares: { label: "Shares", icon: "send" },
};

export type Attachment = {
  id: string;
  fileUrl: string;
  fileType: string | null;
  fileName: string | null;
};

export type SavedScriptSummary = {
  id: string;
  hookText: string;
  bodyText: string | null;
  ctaText: string | null;
  ownerUsername: string | null;
  views: number | null;
  likes: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  durationSeconds: number | null;
};

export type Idea = {
  id: string;
  text: string;
  createdAt: string;
  sourceReelId: string | null;
  attachments: Attachment[];
  scheduledDate: string | null;
  scheduledTimeMinutes: number | null;
  posted: boolean;
  postedAt: string | null;
  scripted: boolean;
  scriptId: string | null;
  hook: string;
  body: string;
  cta: string;
  scriptUpdatedAt: string | null;
  format: "reel" | "carousel";
  goal: "views" | "comments" | "shares" | null;
  inspirationReelId: string | null;
  inspiration: SavedScriptSummary | null;
};

type Stage = "raw" | "scripted" | "sched" | "posted";

const STATUS: Record<Stage, { label: string; dot: string; bg: string; fg: string }> = {
  raw: { label: "Draft", dot: "#6B6B69", bg: "#EFEFEE", fg: "#6B6B69" },
  scripted: { label: "Scripted", dot: "#FF1F8F", bg: "#FFE3F0", fg: "#FF1F8F" },
  sched: { label: "Scheduled", dot: "#2F6BFF", bg: "#E3ECFF", fg: "#2F6BFF" },
  posted: { label: "Posted", dot: "#4CAF00", bg: "#EAF8D8", fg: "#4CAF00" },
};

const TABS: { key: "all" | Stage; label: string }[] = [
  { key: "all", label: "All" },
  { key: "raw", label: "Draft" },
  { key: "scripted", label: "Scripted" },
  { key: "sched", label: "Scheduled" },
  { key: "posted", label: "Posted" },
];

export function stageOf(idea: Idea): Stage {
  if (idea.posted) return "posted";
  if (idea.scheduledDate) return "sched";
  if (idea.hook.trim() || idea.body.trim() || idea.cta.trim()) return "scripted";
  return "raw";
}

function fmtDate(value: string) {
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  return d
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase();
}

type SortKey = "created" | "idea" | "status" | "sched" | "posted";

export function IdeaTable({ initial }: { initial: Idea[] }) {
  const [ideas, setIdeas] = useState(initial);
  const [filter, setFilter] = useState<"all" | Stage>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "created", dir: -1 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function updateIdea(id: string, patch: Partial<Idea>) {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function removeIdea(id: string) {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    setChecked((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSelectedId(null);
  }

  function toggleChecked(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function deleteChecked() {
    const ids = [...checked];
    if (ids.length === 0) return;
    setIdeas((prev) => prev.filter((i) => !checked.has(i.id)));
    setChecked(new Set());
    startTransition(async () => {
      await Promise.all(ids.map((id) => deleteIdea(id)));
    });
  }

  const filtered = useMemo(() => {
    return ideas.filter((idea) => filter === "all" || stageOf(idea) === filter);
  }, [ideas, filter]);

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
        setSort(
          active
            ? { key, dir: (sort.dir * -1) as 1 | -1 }
            : { key, dir: key === "idea" || key === "status" ? 1 : -1 },
        ),
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
        <p className="mt-3 text-[15px] font-medium text-[#4a4a48]">
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
              scheduledTimeMinutes: null,
              posted: false,
              postedAt: null,
              scripted: false,
              scriptId: null,
              hook: "",
              body: "",
              cta: "",
              scriptUpdatedAt: null,
              format: "reel",
              goal: null,
              inspirationReelId: null,
              inspiration: null,
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
          <div className="flex items-center gap-3">
            {checked.size > 0 && (
              <button
                type="button"
                onClick={deleteChecked}
                className="flex items-center gap-1.5 rounded-md bg-[#FF1F8F] px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-[#0D0D0D]"
              >
                <MaterialIcon name="delete" size={15} />
                Delete {checked.size} selected
              </button>
            )}
            <span className="text-[13px] font-semibold text-[#4a4a48]">
              {sorted.length} {sorted.length === 1 ? "idea" : "ideas"}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[28px_minmax(0,1fr)_130px_110px_110px_130px_120px] items-center gap-5 border-t-2 border-[#0D0D0D] border-b border-[#CFCFCD] px-3.5 py-2.5 text-xs font-bold text-[#4a4a48]">
              <input
                type="checkbox"
                checked={sorted.length > 0 && sorted.every((i) => checked.has(i.id))}
                onChange={(e) => {
                  if (e.target.checked) setChecked(new Set(sorted.map((i) => i.id)));
                  else setChecked(new Set());
                }}
                className="size-4 cursor-pointer accent-[#FF1F8F]"
              />
              <button
                onClick={hIdea.onClick}
                className={cn("flex items-center gap-0.5 whitespace-nowrap hover:text-[#FF1F8F]", hIdea.active && "text-[#0D0D0D]")}
              >
                <span>Idea</span>
                <span>{hIdea.arrow}</span>
              </button>
              <button
                onClick={hStatus.onClick}
                className={cn("flex items-center gap-0.5 whitespace-nowrap hover:text-[#FF1F8F]", hStatus.active && "text-[#0D0D0D]")}
              >
                <span>Status</span>
                <span>{hStatus.arrow}</span>
              </button>
              <span>Format</span>
              <span>Goal</span>
              <button
                onClick={hSched.onClick}
                className={cn("flex items-center gap-0.5 whitespace-nowrap hover:text-[#FF1F8F]", hSched.active && "text-[#0D0D0D]")}
              >
                <span>Scheduled date</span>
                <span>{hSched.arrow}</span>
              </button>
              <button
                onClick={hPosted.onClick}
                className={cn("flex items-center gap-0.5 whitespace-nowrap hover:text-[#FF1F8F]", hPosted.active && "text-[#0D0D0D]")}
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
                  className="grid cursor-pointer grid-cols-[28px_minmax(0,1fr)_130px_110px_110px_130px_120px] items-center gap-5 border-b border-[#D9D9D7] px-3.5 py-[13px] hover:bg-[#F6F6F5]"
                >
                  <input
                    type="checkbox"
                    checked={checked.has(idea.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleChecked(idea.id)}
                    className="size-4 cursor-pointer accent-[#FF1F8F]"
                  />
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="truncate text-[15px] font-medium">
                      {idea.text || "(no text)"}
                    </span>
                    {idea.attachments.length > 0 && (
                      <span className="shrink-0 text-[11px] font-semibold text-[#4a4a48]">
                        {idea.attachments.length} file{idea.attachments.length === 1 ? "" : "s"}
                      </span>
                    )}
                    {idea.sourceReelId && (
                      <Link
                        href={`/analyze-reel/reel/${idea.sourceReelId}`}
                        prefetch={false}
                        onClick={(e) => e.stopPropagation()}
                        title="This idea came from a reel. Open the reel."
                        aria-label="Open the reel this idea came from"
                        className="flex shrink-0 items-center gap-0.5 rounded-md px-1 py-0.5 text-[#FF1F8F] hover:bg-[#FFF0F7]"
                      >
                        <MaterialIcon name="smart_display" size={16} />
                        <MaterialIcon name="arrow_outward" size={14} />
                      </Link>
                    )}
                  </div>
                  <span
                    className="flex w-fit items-center gap-[7px] rounded-[12px] px-2.5 py-1 text-xs font-bold whitespace-nowrap"
                    style={{ background: s.bg, color: s.fg }}
                  >
                    <span className="size-[7px] rounded-full" style={{ background: s.dot }} />
                    {s.label}
                  </span>
                  <span className="flex w-fit items-center gap-1 rounded-[10px] bg-[#F0F0F1] px-2 py-0.5 text-[11.5px] font-bold whitespace-nowrap">
                    <MaterialIcon
                      name={idea.format === "carousel" ? "view_carousel" : "smart_display"}
                      size={13}
                      weight={500}
                    />
                    {idea.format === "carousel" ? "Carousel" : "Reel"}
                  </span>
                  {idea.goal ? (
                    <span className="flex w-fit items-center gap-1 rounded-[10px] bg-[#F0F0F1] px-2 py-0.5 text-[11.5px] font-bold whitespace-nowrap">
                      <MaterialIcon name={GOAL_META[idea.goal].icon} size={13} weight={500} />
                      {GOAL_META[idea.goal].label}
                    </span>
                  ) : (
                    <span className="text-[13px] font-semibold text-[#9a9a98]">—</span>
                  )}
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
        <IdeaPanel
          idea={selected}
          onClose={() => setSelectedId(null)}
          onUpdate={(patch) => updateIdea(selected.id, patch)}
          onDeleted={() => removeIdea(selected.id)}
        />
      )}
    </PageShell>
  );
}
