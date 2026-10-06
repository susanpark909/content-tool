"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui/material-icon";
import { PageShell } from "@/components/ui/page-shell";

type Goals = {
  followerGoal: number | null;
  revenueGoal: number | null;
  postingGoal: number | null;
  goalDate: string | null;
  currentFollowers: number | null;
  currentRevenue: number | null;
  idealClientName: string;
  idealClientTags: string;
  idealClientAbout: string;
  idealClientPainPoints: string[];
  idealClientDesires: string[];
  idealClientTopics: string[];
};

const MOODS = [
  "Warming up",
  "Finding your groove",
  "On a roll",
  "Final stretch",
  "Goal smashed. Nice.",
];

function fmt(v: number, money?: boolean) {
  return (money ? "$" : "") + Math.round(v).toLocaleString("en-US");
}

function short(v: number, money?: boolean) {
  return (money ? "$" : "") + (v >= 1000 ? +(v / 1000).toFixed(1) + "k" : Math.round(v));
}

// Ports the design's tile-layout algorithm: pick a row/col split close to a
// wide (A=5) aspect ratio, preferring an exact divisor of nTiles.
function computeTileRows(nTiles: number, filled: boolean[]) {
  const quarter = Math.max(1, Math.round(nTiles / 4));
  const tiles = Array.from({ length: nTiles }, (_, i) => ({
    on: filled[i] ?? false,
    quarterMark: (i + 1) % quarter === 0,
  }));
  const A = 5;
  let best: { r: number; sc: number } | null = null;
  for (let r = 1; r <= nTiles; r++) {
    if (nTiles % r === 0) {
      const sc = Math.abs(Math.log(nTiles / r / r / A));
      if (!best || sc < best.sc) best = { r, sc };
    }
  }
  let rows: number, cols: number;
  if (best && best.sc < Math.log(2.2)) {
    rows = best.r;
    cols = nTiles / rows;
  } else {
    rows = Math.max(1, Math.round(Math.sqrt(nTiles / A)));
    cols = Math.ceil(nTiles / rows);
  }
  const w = `calc((100% - ${(cols - 1) * 2}px) / ${cols})`;
  const out: { w: string; tiles: { on: boolean; quarterMark: boolean }[] }[] = [];
  let i = 0;
  let left = nTiles;
  for (let r = 0; r < rows; r++) {
    const k = Math.ceil(left / (rows - r));
    out.push({ w, tiles: tiles.slice(i, i + k) });
    i += k;
    left -= k;
  }
  return out;
}

function quest(
  goalV: number | null,
  nowV: number,
  label: string,
  icon: string,
  unit: string,
  money: boolean,
  isBar: boolean,
  mounted: boolean,
) {
  const goal = Math.max(1, goalV || 1);
  const now = Math.max(0, nowV || 0);
  const p = now / goal;
  const got = Math.min(4, Math.floor(p * 4 + 1e-9));
  const nextV = got < 4 ? Math.ceil((goal * (got + 1)) / 4) : null;
  const away = nextV != null ? nextV - now : 0;
  const shown = mounted ? Math.min(1, p) : 0;
  const nTiles = Math.min(goal, 180);
  const filledCount = Math.round(Math.min(1, p) * nTiles);
  const filled = Array.from({ length: nTiles }, (_, i) => mounted && i < filledCount);

  return {
    label,
    icon,
    isBar,
    hasGoal: goalV != null,
    nowText: fmt(now, money),
    goalText: fmt(goal, money),
    mood: MOODS[got],
    pctText: Math.round(p * 100) + "%",
    fillW: shown * 100 + "%",
    checkpoints: [1, 2, 3, 4].map((i) => ({
      left: `calc(${i * 25}% - ${i === 4 ? 5 : 0}px)`,
      passed: mounted && got >= i,
      label: short((goal * i) / 4, money),
    })),
    tileRows: isBar ? [] : computeTileRows(nTiles, filled),
    next:
      nextV != null
        ? `Next checkpoint ${short(nextV, money)} · ${fmt(away, money)}${unit ? " " + unit : ""} away`
        : "All checkpoints collected",
  };
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function numbered(items: string[]) {
  return items
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t, i) => ({ n: i + 1, t }));
}

export function GoalsView({ initial, postsMade: initialPosts }: { initial: Goals; postsMade: number }) {
  const [goals, setGoals] = useState(initial);
  const [postsMade, setPostsMade] = useState(initialPosts);
  useEffect(() => setPostsMade(initialPosts), [initialPosts]);
  useEffect(() => setGoals(initial), [initial]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const days = daysUntil(goals.goalDate);
  const tags = goals.idealClientTags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const quests = [
    quest(goals.followerGoal, goals.currentFollowers ?? 0, "Followers", "group", "followers", false, true, mounted),
    quest(goals.revenueGoal, goals.currentRevenue ?? 0, "Revenue", "payments", "", true, true, mounted),
    quest(goals.postingGoal, postsMade, "Posts", "grid_view", "posts", false, false, mounted),
  ];

  const hasAnyGoal = Boolean(goals.followerGoal || goals.revenueGoal || goals.postingGoal);
  const painPoints = numbered(goals.idealClientPainPoints);
  const desires = numbered(goals.idealClientDesires);
  const topics = numbered(goals.idealClientTopics);
  const hasIdealClientDetail = painPoints.length > 0 || desires.length > 0 || topics.length > 0;

  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[34px] md:text-[64px] leading-[0.95] font-black tracking-[-0.04em]">
            Welcome back
            <span className="ml-1 inline-block size-2 md:size-3 rounded-full bg-[#C6FF3D] align-baseline" />
          </h1>
          <p className="mt-1 text-[13.5px] md:mt-2 md:text-[15px] font-medium text-[#4a4a48]">
            Hey Susan. Know where you&apos;re going.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="h-[22px] w-1 rounded-[2px] bg-[#FF1F8F]" />
          <span className="text-xl md:text-2xl font-black tracking-[-0.025em]">My Goals</span>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Followers", icon: "group", value: fmt(goals.followerGoal ?? 0) },
            { label: "Revenue", icon: "payments", value: fmt(goals.revenueGoal ?? 0, true) },
            { label: "Posts", icon: "grid_view", value: fmt(goals.postingGoal ?? 0) },
          ].map((g) => (
            <div
              key={g.label}
              className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-[#F0F0F1] bg-white px-5 py-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)]"
            >
              <span className="flex items-center gap-1.5 text-[13px] font-bold whitespace-nowrap text-[#4a4a48]">
                <MaterialIcon name={g.icon} size={18} className="text-[#D10A6E]" />
                <span>{g.label}</span>
              </span>
              <span
                className="leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap"
                style={{ fontSize: "clamp(24px, 2.6vw, 36px)" }}
              >
                {g.value}
              </span>
            </div>
          ))}
          <div className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-[#F0F0F1] bg-white px-5 py-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
            <span className="flex items-center gap-1.5 text-[13px] font-bold whitespace-nowrap text-[#4a4a48]">
              <MaterialIcon name="calendar_month" size={18} className="text-[#D10A6E]" />
              <span>Goal period</span>
            </span>
            {days != null ? (
              <>
                <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                  <span
                    className="leading-none font-extrabold tracking-[-0.03em]"
                    style={{ fontSize: "clamp(24px, 2.6vw, 36px)" }}
                  >
                    {days}
                  </span>
                  <span className="text-[13px] font-semibold text-[#4a4a48]">days left</span>
                </div>
                <span className="-mt-1 text-xs font-semibold text-[#4a4a48]">
                  Ends {goals.goalDate ? formatDate(goals.goalDate) : "—"}
                </span>
              </>
            ) : (
              <span className="text-[13px] font-semibold text-[#4a4a48]">
                Set a target date to see your countdown.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="h-[22px] w-1 rounded-[2px] bg-[#FF1F8F]" />
          <span className="text-xl md:text-2xl font-black tracking-[-0.025em]">Progress</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-4">
          {quests.map((q) => (
            <div
              key={q.label}
              className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-[#F0F0F1] bg-white px-3.5 py-2.5 shadow-[0_4px_16px_rgba(13,13,13,0.09)] md:gap-3 md:px-5 md:py-4"
            >
              <div className="flex items-center justify-between gap-3 md:flex-col md:items-stretch md:gap-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-[13px] font-bold whitespace-nowrap text-[#4a4a48]">
                    <MaterialIcon name={q.icon} size={18} className="text-[#D10A6E]" />
                    <span>{q.label}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-0">
                  <div className="flex flex-wrap items-baseline justify-end gap-1.5 whitespace-nowrap md:justify-start">
                    <span
                      className="leading-none font-extrabold tracking-[-0.03em]"
                      style={{ fontSize: "clamp(24px, 2.6vw, 36px)" }}
                    >
                      {q.nowText}
                    </span>
                    <span className="text-[13px] font-semibold text-[#4a4a48]">of {q.goalText}</span>
                  </div>
                  <span className="-mt-1.5 hidden text-xs font-bold whitespace-nowrap text-[#4a4a48] md:block">
                    {q.mood}
                  </span>
                </div>
              </div>

              {q.isBar ? (
                <div className="flex h-[38px] flex-col justify-center md:h-[76px]">
                  <div className="relative pb-[18px]">
                    <div className="relative h-2 overflow-hidden rounded-[4px] bg-[#EDEDEB]">
                      <div
                        className="absolute inset-y-0 left-0 rounded-[4px] bg-[#FF1F8F] transition-[width] duration-[1.1s] ease-[cubic-bezier(.2,.8,.2,1)]"
                        style={{ width: q.fillW }}
                      />
                    </div>
                    {q.checkpoints.map((c, i) => (
                      <div
                        key={i}
                        className="absolute -top-px flex -translate-x-1/2 flex-col items-center"
                        style={{ left: c.left }}
                      >
                        <span
                          className="size-2.5 flex-none rotate-45 border-[1.5px] border-[#0D0D0D] box-border transition-colors"
                          style={{ backgroundColor: c.passed ? "#C6FF3D" : "#FBFBFA" }}
                        />
                        <span className="mt-[5px] text-[10.5px] font-semibold whitespace-nowrap text-[#4a4a48]">
                          {c.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-[38px] flex-col gap-0.5 md:h-[76px]">
                  {q.tileRows.map((row, ri) => (
                    <div key={ri} className="flex flex-1 min-h-0 justify-center gap-0.5">
                      {row.tiles.map((t, ti) => (
                        <span
                          key={ti}
                          className="rounded-[2px] transition-colors"
                          style={{
                            flex: `0 0 ${row.w}`,
                            backgroundColor: t.on ? "#FF1F8F" : "#E4E4E2",
                            boxShadow: t.quarterMark ? "inset 0 0 0 2px #0D0D0D" : "none",
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-[#F0F0F1] pt-1.5 text-[12px] md:pt-2.5 md:text-[12.5px] font-semibold text-[#4a4a48]">
                <span>{q.next}</span>
                <span className="font-extrabold whitespace-nowrap text-[#0D0D0D]">{q.pctText}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 rounded-lg bg-[#0D0D0D] p-4 text-[#FBFBFA] md:gap-6 md:p-6 lg:grid-cols-2">
        <div className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 md:grid-cols-[72px_minmax(0,1fr)] md:items-start md:gap-5">
          <div className="flex size-11 items-center justify-center rounded-lg bg-[#FF1F8F] text-[#0D0D0D] max-md:row-span-2 md:size-[72px]">
            <MaterialIcon name="person" size={38} weight={300} className="max-md:text-[26px]!" />
          </div>
          <div className="flex min-w-0 flex-col gap-2.5 max-md:contents">
            <div className="text-[11px] font-extrabold tracking-[0.14em] text-[#C6FF3D]">
              YOUR IDEAL CLIENT
            </div>
            <div className="text-[22px] leading-[1.05] font-black tracking-[-0.025em] md:text-[28px]">
              {goals.idealClientName || "Add a name for them"}
            </div>
            {goals.idealClientAbout && (
              <div className="max-w-[62ch] text-[13.5px] leading-[1.45] text-[#D4D4D2] max-md:col-span-2 md:text-sm md:leading-[1.5]">
                {goals.idealClientAbout}
              </div>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-md:col-span-2 md:mt-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-[12px] border border-[#4a4a48] px-2 py-0.5 text-[11px] font-bold text-[#EDEDEB] md:px-2.5 md:py-1 md:text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {hasIdealClientDetail ? (
          <div className="flex min-w-0 flex-col gap-3.5 border-[#2a2a2a] pt-4 md:gap-[18px] md:pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6 border-t">
            <div className="grid grid-cols-2 gap-3 md:gap-5">
              {painPoints.length > 0 && (
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex items-center gap-2 text-[13px] font-bold">
                    <MaterialIcon name="target" size={18} className="text-[#FF1F8F]" />
                    <span>Their Pain Points</span>
                  </div>
                  {painPoints.map((it) => (
                    <div key={it.n} className="flex items-center gap-2.5 text-[13px] text-[#D4D4D2]">
                      <span className="flex size-[18px] flex-none items-center justify-center rounded-full bg-[#262626] text-[10px] font-bold text-[#EDEDEB]">
                        {it.n}
                      </span>
                      <span>{it.t}</span>
                    </div>
                  ))}
                </div>
              )}
              {desires.length > 0 && (
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex items-center gap-2 text-[13px] font-bold">
                    <MaterialIcon name="emoji_events" size={18} className="text-[#FF1F8F]" />
                    <span>What They Want</span>
                  </div>
                  {desires.map((it) => (
                    <div key={it.n} className="flex items-center gap-2.5 text-[13px] text-[#D4D4D2]">
                      <span className="flex size-[18px] flex-none items-center justify-center rounded-full bg-[#262626] text-[10px] font-bold text-[#EDEDEB]">
                        {it.n}
                      </span>
                      <span>{it.t}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {topics.length > 0 && (
              <div className="flex min-w-0 flex-col gap-2 border-t border-[#2a2a2a] pt-3.5 md:gap-2.5 md:pt-4">
                <div className="flex items-center gap-2 text-[13px] font-bold">
                  <MaterialIcon name="article" size={18} className="text-[#FF1F8F]" />
                  <span>My Content Topics</span>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                  {topics.map((it) => (
                    <div key={it.n} className="flex items-center gap-2.5 text-[13px] text-[#D4D4D2]">
                      <span className="flex size-[18px] flex-none items-center justify-center rounded-full bg-[#262626] text-[10px] font-bold text-[#EDEDEB]">
                        {it.n}
                      </span>
                      <span>{it.t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-w-0 items-center border-[#2a2a2a] pt-5 text-sm text-[#9a9a98] lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6 border-t">
            Add their pain points, wants and your content topics in Settings → Brand &amp; Audience to fill this in.
          </div>
        )}
      </div>

      {!hasAnyGoal && (
        <p className="text-sm text-[#4a4a48]">
          No goals set yet — set them in{" "}
          <Link href="/settings" className="font-bold underline underline-offset-2 hover:text-[#FF1F8F]">
            Settings → Goals
          </Link>
          .
        </p>
      )}
    </PageShell>
  );
}
