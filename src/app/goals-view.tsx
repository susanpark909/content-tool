"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { PageShell } from "@/components/ui/page-shell";
import { cn } from "@/lib/utils";
import { saveGoals, type GoalFields } from "./goal-actions";

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
  const filled = Math.round(Math.min(1, p) * nTiles);
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
      left: `calc(${i * 25}% - ${i === 4 ? 9 : 0}px)`,
      passed: mounted && got >= i,
      label: short((goal * i) / 4, money),
    })),
    tiles: Array.from({ length: nTiles }, (_, i) => ({
      filled: mounted && i < filled,
      quarterMark: (i + 1) % Math.round(nTiles / 4) === 0,
    })),
    next:
      nextV != null
        ? `Up next: ${short(nextV, money)} · ${fmt(away, money)}${unit ? " " + unit : ""} away`
        : "Goal fully reached",
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

export function GoalsView({ initial, postsMade }: { initial: Goals; postsMade: number }) {
  const [goals, setGoals] = useState(initial);
  const [editing, setEditing] = useState(false);
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

  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[64px] leading-[0.95] font-black tracking-[-0.04em]">
            Welcome back
            <span className="ml-1 inline-block size-3 rounded-full bg-[#C6FF3D] align-baseline" />
          </h1>
          <p className="mt-2 text-[15px] font-medium text-[#4a4a48]">
            Hey Susan. Here&apos;s the game you&apos;re playing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-2 rounded-[4px] border-2 border-[#0D0D0D] bg-[#FBFBFA] px-3.5 py-2 text-[13px] font-extrabold hover:bg-[#0D0D0D] hover:text-[#FBFBFA]"
        >
          <MaterialIcon name="tune" size={17} />
          Edit goals
        </button>
      </div>

      <div className="relative flex flex-col gap-5.5 overflow-hidden rounded-[10px] border-2 border-[#F0F0F1] bg-[#F6F6F5] px-9 pt-7 pb-8.5 shadow-[0_2px_10px_rgba(13,13,13,0.07)]">
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-2/5 bg-cover bg-center opacity-[.14]"
          style={{ backgroundImage: "url(/brand/sidebar-paint.png)" }}
        />
        <div className="relative flex items-center gap-3.5">
          <span className="h-7 w-[5px] rounded-[3px] bg-[#FF1F8F]" />
          <span className="text-[32px] font-black tracking-[-0.025em]">My Goals</span>
        </div>
        <div className="relative flex flex-col gap-6 overflow-hidden sm:flex-row sm:items-stretch sm:gap-0">
          {[
            { label: "Followers", icon: "group", value: fmt(goals.followerGoal ?? 0) },
            { label: "Revenue", icon: "payments", value: fmt(goals.revenueGoal ?? 0, true) },
            { label: "Posts", icon: "grid_view", value: fmt(goals.postingGoal ?? 0) },
          ].map((g, i) => (
            <Fragment key={g.label}>
              {i > 0 && (
                <div key={`div-${g.label}`} className="hidden items-center justify-center sm:flex sm:flex-1">
                  <span className="h-full w-px bg-[#D9D9D7]" />
                </div>
              )}
              <div
                key={g.label}
                className="flex flex-none flex-col items-center gap-3 text-center"
              >
                <span className="flex items-center gap-2.5 text-[17px] font-bold text-[#D10A6E]">
                  <MaterialIcon name={g.icon} size={24} weight={400} />
                  <span>{g.label}</span>
                </span>
                <span
                  className="leading-[.9] font-black tracking-[-0.05em] whitespace-nowrap"
                  style={{ fontSize: "clamp(48px, 5.5vw, 80px)" }}
                >
                  {g.value}
                </span>
              </div>
            </Fragment>
          ))}
        </div>
      </div>

      <div className="-mb-3.5 text-2xl font-black tracking-[-0.02em]">Progress</div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {quests.map((q) => (
          <div
            key={q.label}
            className="flex min-h-[280px] flex-col gap-4.5 rounded-[8px] border-2 border-[#F0F0F1] bg-[#F6F6F5] px-5.5 pt-5.5 pb-5 shadow-[0_2px_10px_rgba(13,13,13,0.07)]"
          >
            <div className="flex items-center gap-2 text-sm font-extrabold">
              <MaterialIcon name={q.icon} size={20} weight={400} />
              <span>{q.label}</span>
            </div>
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[48px] leading-none font-black tracking-[-0.035em]">
                  {q.nowText}
                </span>
                <span className="text-[15px] font-semibold text-[#4a4a48]">of {q.goalText}</span>
              </div>
              <div className="mt-2 text-[13px] font-bold">{q.mood}</div>
            </div>

            {q.isBar ? (
              <div className="relative pb-5.5">
                <div className="relative h-[18px] overflow-hidden rounded-[4px] bg-[#E4E4E2]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-[4px] bg-[#FF1F8F] transition-[width] duration-[1.1s] ease-[cubic-bezier(.2,.8,.2,1)]"
                    style={{ width: q.fillW }}
                  />
                </div>
                {q.checkpoints.map((c, i) => (
                  <div
                    key={i}
                    className="absolute top-0 flex h-[18px] -translate-x-1/2 flex-col items-center"
                    style={{ left: c.left }}
                  >
                    <span
                      className="mt-0.5 size-3.5 flex-none rotate-45 border-2 border-[#0D0D0D] transition-colors"
                      style={{ backgroundColor: c.passed ? "#C6FF3D" : "#FBFBFA" }}
                    />
                    <span className="mt-2 text-[10.5px] font-bold whitespace-nowrap text-[#4a4a48]">
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(18,minmax(0,1fr))] gap-[3px]">
                {q.tiles.map((t, i) => (
                  <span
                    key={i}
                    className="aspect-square rounded-[2px] transition-colors"
                    style={{
                      backgroundColor: t.filled ? "#FF1F8F" : "#E4E4E2",
                      boxShadow: t.quarterMark ? "inset 0 0 0 2px #0D0D0D" : "none",
                    }}
                  />
                ))}
              </div>
            )}

            <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-[#D9D9D7] pt-3.5 text-[13px] font-semibold text-[#4a4a48]">
              <span>{q.next}</span>
              <span className="font-extrabold whitespace-nowrap text-[#0D0D0D]">{q.pctText}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="grid grid-cols-[160px_minmax(0,1fr)] items-stretch gap-5.5 rounded-[8px] bg-[#0D0D0D] p-6 text-[#FBFBFA] lg:col-span-2">
          <div className="flex h-full w-full items-center justify-center rounded-[8px] bg-[#FF1F8F] text-[#0D0D0D]">
            <MaterialIcon name="person" size={44} weight={300} />
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="text-[11px] font-extrabold tracking-[.14em] text-[#C6FF3D]">
              YOUR IDEAL CLIENT
            </div>
            <div className="text-[30px] leading-[1.05] font-black tracking-[-0.025em]">
              {goals.idealClientName || "Add a name for them"}
            </div>
            {goals.idealClientAbout && (
              <div className="max-w-[62ch] text-[15px] leading-[1.5] text-[#D4D4D2]">
                {goals.idealClientAbout}
              </div>
            )}
            {tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-[12px] border border-[#4a4a48] px-2.5 py-1 text-xs font-bold text-[#EDEDEB]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3.5 rounded-[8px] border-2 border-[#F0F0F1] bg-[#F6F6F5] p-6 shadow-[0_2px_10px_rgba(13,13,13,0.07)]">
          <div className="flex items-center gap-2.5 text-base font-extrabold">
            <MaterialIcon name="calendar_month" size={22} />
            <span>Goal Period</span>
          </div>
          {days != null ? (
            <div className="flex items-baseline gap-2.5">
              <span className="text-[64px] leading-none font-black tracking-[-0.04em]">{days}</span>
              <span className="text-lg font-extrabold">days left</span>
            </div>
          ) : (
            <p className="text-sm text-[#4a4a48]">Set a target date to see your countdown.</p>
          )}
          <div className="mt-auto flex flex-col gap-1 border-t border-[#D9D9D7] pt-3.5">
            <span className="text-[13px] font-semibold text-[#4a4a48]">Goal date</span>
            <span className="text-xl font-extrabold">
              {goals.goalDate ? formatDate(goals.goalDate) : "Not set"}
            </span>
          </div>
        </div>
      </div>

      {editing && (
        <EditDrawer
          initial={goals}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setGoals(next);
            setEditing(false);
          }}
        />
      )}

      {!hasAnyGoal && !editing && (
        <p className="text-sm text-[#4a4a48]">
          No goals set yet — click &quot;Edit goals&quot; above to set the game.
        </p>
      )}
    </PageShell>
  );
}

function EditDrawer({
  initial,
  onClose,
  onSaved,
}: {
  initial: Goals;
  onClose: () => void;
  onSaved: (goals: Goals) => void;
}) {
  const [followerGoal, setFollowerGoal] = useState(initial.followerGoal?.toString() ?? "");
  const [currentFollowers, setCurrentFollowers] = useState(
    initial.currentFollowers?.toString() ?? "",
  );
  const [revenueGoal, setRevenueGoal] = useState(initial.revenueGoal?.toString() ?? "");
  const [currentRevenue, setCurrentRevenue] = useState(initial.currentRevenue?.toString() ?? "");
  const [postingGoal, setPostingGoal] = useState(initial.postingGoal?.toString() ?? "");
  const [goalDate, setGoalDate] = useState(initial.goalDate ?? "");
  const [idealClientName, setIdealClientName] = useState(initial.idealClientName);
  const [idealClientTags, setIdealClientTags] = useState(initial.idealClientTags);
  const [idealClientAbout, setIdealClientAbout] = useState(initial.idealClientAbout);
  const [isSaving, startSaving] = useTransition();

  const fields: { label: string; type: string; value: string; onChange: (v: string) => void }[] = [
    { label: "Follower goal", type: "number", value: followerGoal, onChange: setFollowerGoal },
    { label: "Followers now", type: "number", value: currentFollowers, onChange: setCurrentFollowers },
    { label: "Revenue goal ($)", type: "number", value: revenueGoal, onChange: setRevenueGoal },
    { label: "Revenue earned ($)", type: "number", value: currentRevenue, onChange: setCurrentRevenue },
    { label: "Posting goal", type: "number", value: postingGoal, onChange: setPostingGoal },
    { label: "By when", type: "date", value: goalDate, onChange: setGoalDate },
    { label: "Ideal client, in a few words", type: "text", value: idealClientName, onChange: setIdealClientName },
    { label: "Tags (comma separated)", type: "text", value: idealClientTags, onChange: setIdealClientTags },
  ];

  function handleSave() {
    const next: GoalFields = {
      followerGoal: followerGoal ? Number(followerGoal) : null,
      revenueGoal: revenueGoal ? Number(revenueGoal) : null,
      postingGoal: postingGoal ? Number(postingGoal) : null,
      goalDate: goalDate || null,
      currentFollowers: currentFollowers ? Number(currentFollowers) : null,
      currentRevenue: currentRevenue ? Number(currentRevenue) : null,
      idealClientName,
      idealClientTags,
      idealClientAbout,
    };
    startSaving(async () => {
      await saveGoals(next);
      onSaved(next);
    });
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-[#0D0D0D]/45"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-[420px] max-w-full flex-col gap-4.5 overflow-y-auto border-l-2 border-[#0D0D0D] bg-[#FBFBFA] px-7 py-8"
      >
        <div className="flex items-center justify-between">
          <span className="text-[28px] font-black tracking-[-0.03em]">Set the game</span>
          <button type="button" onClick={onClose} aria-label="Close">
            <MaterialIcon name="close" size={24} />
          </button>
        </div>

        {fields.map((f) => (
          <label key={f.label} className="flex flex-col gap-1.5 text-xs font-bold text-[#4a4a48]">
            {f.label}
            <input
              type={f.type}
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              className="rounded-[4px] border border-[#CFCFCD] bg-[#F6F6F5] px-3 py-2.5 text-base font-semibold text-[#0D0D0D] outline-none focus:border-[#0D0D0D]"
            />
          </label>
        ))}

        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#4a4a48]">
          About your ideal client
          <textarea
            value={idealClientAbout}
            onChange={(e) => setIdealClientAbout(e.target.value)}
            rows={4}
            className="resize-y rounded-[4px] border border-[#CFCFCD] bg-[#F6F6F5] px-3 py-2.5 text-[15px] leading-[1.45] font-medium text-[#0D0D0D] outline-none focus:border-[#0D0D0D]"
          />
        </label>

        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="flex items-center gap-2 self-start rounded-[4px] bg-[#FF1F8F] py-2.5 pr-5 pl-4 text-sm font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F]"
        >
          <MaterialIcon name="bolt" size={18} weight={500} />
          {isSaving ? "Saving..." : "Let's play"}
        </button>
      </div>
    </div>
  );
}
