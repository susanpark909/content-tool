"use client";

import { useState, useTransition } from "react";
import { PencilIcon, UsersIcon, DollarSignIcon, SendIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { saveGoals, type GoalFields } from "./goal-actions";

type Goals = {
  followerGoal: number | null;
  revenueGoal: number | null;
  postingGoal: number | null;
  goalDate: string | null;
  idealClient: string;
  currentFollowers: number | null;
  currentRevenue: number | null;
};

function tierMessage(pct: number) {
  if (pct >= 100) return "Goal smashed! 🎉";
  if (pct >= 75) return "So close you can taste it ⚡";
  if (pct >= 50) return "Halfway there — keep going 🔥";
  if (pct >= 25) return "Cruising along 🚀";
  if (pct > 0) return "Building momentum 🌿";
  return "Just getting started 🌱";
}

function pctOf(current: number | null, goal: number | null) {
  if (!goal || goal <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((current ?? 0) / goal) * 100)));
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function ProgressStat({
  icon,
  label,
  current,
  goal,
  formatValue,
}: {
  icon: React.ReactNode;
  label: string;
  current: number;
  goal: number | null;
  formatValue: (n: number) => string;
}) {
  const pct = pctOf(current, goal);
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {label}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold">{formatValue(current)}</span>
          {goal != null && (
            <span className="text-sm text-muted-foreground">
              / {formatValue(goal)}
            </span>
          )}
        </div>
        {goal != null ? (
          <>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {pct}% · {tierMessage(pct)}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Set a goal to track progress</p>
        )}
      </CardContent>
    </Card>
  );
}

export function GoalsView({
  initial,
  postsMade,
}: {
  initial: Goals;
  postsMade: number;
}) {
  const [goals, setGoals] = useState(initial);
  const [editing, setEditing] = useState(
    !initial.followerGoal && !initial.revenueGoal && !initial.postingGoal,
  );

  const days = daysUntil(goals.goalDate);

  if (editing) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Set your goals</h1>
          <p className="text-sm text-muted-foreground">
            What are you working toward? You can change these anytime.
          </p>
        </div>
        <GoalsForm
          initial={goals}
          onSaved={(next) => {
            setGoals(next);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          showCancel={Boolean(
            goals.followerGoal || goals.revenueGoal || goals.postingGoal,
          )}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <SparklesIcon className="size-6 text-primary" />
            Your Quest
          </h1>
          <p className="text-sm text-muted-foreground">
            Progress toward the goals you set for yourself.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <PencilIcon />
          Edit goals
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ProgressStat
          icon={<UsersIcon className="size-4 text-muted-foreground" />}
          label="Followers"
          current={goals.currentFollowers ?? 0}
          goal={goals.followerGoal}
          formatValue={(n) => n.toLocaleString()}
        />
        <ProgressStat
          icon={<DollarSignIcon className="size-4 text-muted-foreground" />}
          label="Revenue"
          current={goals.currentRevenue ?? 0}
          goal={goals.revenueGoal}
          formatValue={(n) => `$${n.toLocaleString()}`}
        />
        <ProgressStat
          icon={<SendIcon className="size-4 text-muted-foreground" />}
          label="Posts"
          current={postsMade}
          goal={goals.postingGoal}
          formatValue={(n) => n.toLocaleString()}
        />
      </div>

      {goals.goalDate && (
        <p className="text-sm text-muted-foreground">
          🎯 Goal date: <span className="text-foreground">{formatDate(goals.goalDate)}</span>
          {days != null && days >= 0 && ` — ${days} day${days === 1 ? "" : "s"} to go`}
          {days != null && days < 0 && " — the date's come and gone, keep going anyway"}
        </p>
      )}

      {goals.idealClient && (
        <Card>
          <CardContent className="flex flex-col gap-1.5 p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Who you&apos;re talking to
            </p>
            <p className="text-sm whitespace-pre-wrap">{goals.idealClient}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GoalsForm({
  initial,
  onSaved,
  onCancel,
  showCancel,
}: {
  initial: Goals;
  onSaved: (goals: Goals) => void;
  onCancel: () => void;
  showCancel: boolean;
}) {
  const [followerGoal, setFollowerGoal] = useState(initial.followerGoal?.toString() ?? "");
  const [revenueGoal, setRevenueGoal] = useState(initial.revenueGoal?.toString() ?? "");
  const [postingGoal, setPostingGoal] = useState(initial.postingGoal?.toString() ?? "");
  const [goalDate, setGoalDate] = useState(initial.goalDate ?? "");
  const [idealClient, setIdealClient] = useState(initial.idealClient);
  const [currentFollowers, setCurrentFollowers] = useState(
    initial.currentFollowers?.toString() ?? "",
  );
  const [currentRevenue, setCurrentRevenue] = useState(
    initial.currentRevenue?.toString() ?? "",
  );
  const [isSaving, startSaving] = useTransition();

  function handleSave() {
    const fields: GoalFields = {
      followerGoal: followerGoal ? Number(followerGoal) : null,
      revenueGoal: revenueGoal ? Number(revenueGoal) : null,
      postingGoal: postingGoal ? Number(postingGoal) : null,
      goalDate: goalDate || null,
      idealClient,
      currentFollowers: currentFollowers ? Number(currentFollowers) : null,
      currentRevenue: currentRevenue ? Number(currentRevenue) : null,
    };
    startSaving(async () => {
      await saveGoals(fields);
      onSaved(fields);
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="follower-goal">Follower goal</Label>
            <Input
              id="follower-goal"
              type="number"
              value={followerGoal}
              onChange={(e) => setFollowerGoal(e.target.value)}
              placeholder="10000"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="revenue-goal">Revenue goal</Label>
            <Input
              id="revenue-goal"
              type="number"
              value={revenueGoal}
              onChange={(e) => setRevenueGoal(e.target.value)}
              placeholder="10000"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="posting-goal">Posting goal</Label>
            <Input
              id="posting-goal"
              type="number"
              value={postingGoal}
              onChange={(e) => setPostingGoal(e.target.value)}
              placeholder="100"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-date">By what date</Label>
            <Input
              id="goal-date"
              type="date"
              value={goalDate}
              onChange={(e) => setGoalDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ideal-client">My ideal client</Label>
          <Textarea
            id="ideal-client"
            value={idealClient}
            onChange={(e) => setIdealClient(e.target.value)}
            placeholder="Who are you creating for?"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 border-t pt-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current-followers">Current followers</Label>
            <Input
              id="current-followers"
              type="number"
              value={currentFollowers}
              onChange={(e) => setCurrentFollowers(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current-revenue">Current revenue</Label>
            <Input
              id="current-revenue"
              type="number"
              value={currentRevenue}
              onChange={(e) => setCurrentRevenue(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button disabled={isSaving} onClick={handleSave}>
            {isSaving ? "Saving..." : "Save goals"}
          </Button>
          {showCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
