"use client";

import { useState, useTransition } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ActionDialog } from "@/components/action-dialog";
import { resetProgress, saveGoalNumbers } from "@/app/goal-actions";

export type GoalNumbers = {
  followerGoal: number | null;
  currentFollowers: number | null;
  revenueGoal: number | null;
  currentRevenue: number | null;
  postingGoal: number | null;
  goalDate: string | null;
};

const inputClass =
  "h-[46px] w-full rounded-md border border-[#E4E4E2] bg-white px-3 text-base font-semibold text-[#0D0D0D] outline-none focus:border-[#0D0D0D]";

export function GoalsTab({ initial }: { initial: GoalNumbers }) {
  const [followerGoal, setFollowerGoal] = useState(initial.followerGoal?.toString() ?? "");
  const [currentFollowers, setCurrentFollowers] = useState(initial.currentFollowers?.toString() ?? "");
  const [revenueGoal, setRevenueGoal] = useState(initial.revenueGoal?.toString() ?? "");
  const [currentRevenue, setCurrentRevenue] = useState(initial.currentRevenue?.toString() ?? "");
  const [postingGoal, setPostingGoal] = useState(initial.postingGoal?.toString() ?? "");
  const [goalDate, setGoalDate] = useState(initial.goalDate ?? "");
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [, startReset] = useTransition();

  const fields: { label: string; type: string; value: string; onChange: (v: string) => void }[] = [
    { label: "Follower goal", type: "number", value: followerGoal, onChange: setFollowerGoal },
    { label: "Followers now", type: "number", value: currentFollowers, onChange: setCurrentFollowers },
    { label: "Revenue goal ($)", type: "number", value: revenueGoal, onChange: setRevenueGoal },
    { label: "Revenue earned ($)", type: "number", value: currentRevenue, onChange: setCurrentRevenue },
    { label: "Posting goal", type: "number", value: postingGoal, onChange: setPostingGoal },
    { label: "By when", type: "date", value: goalDate, onChange: setGoalDate },
  ];

  function handleSave() {
    setError("");
    setSaved(false);
    startSaving(async () => {
      try {
        await saveGoalNumbers({
          followerGoal: followerGoal ? Number(followerGoal) : null,
          currentFollowers: currentFollowers ? Number(currentFollowers) : null,
          revenueGoal: revenueGoal ? Number(revenueGoal) : null,
          currentRevenue: currentRevenue ? Number(currentRevenue) : null,
          postingGoal: postingGoal ? Number(postingGoal) : null,
          goalDate: goalDate || null,
        });
        setSaved(true);
      } catch {
        setError("Couldn't save your goals.");
      }
    });
  }

  function handleReset() {
    setConfirmingReset(false);
    setCurrentFollowers("");
    setCurrentRevenue("");
    setResetDone(false);
    startReset(async () => {
      try {
        await resetProgress();
        setResetDone(true);
      } catch {
        setError("Couldn't reset your progress.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-4 rounded-lg border border-[#F0F0F1] bg-white p-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)] sm:p-5.5">
        <div className="flex flex-col gap-1">
          <span className="text-xl font-black tracking-[-0.02em]">Your Goals</span>
          <span className="text-[13px] font-semibold text-[#4a4a48]">
            What you&apos;re aiming for, and where you are right now.
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {fields.map((f) => (
            <label key={f.label} className="flex flex-col gap-1.5 text-xs font-bold text-[#4a4a48]">
              {f.label}
              <input
                type={f.type}
                value={f.value}
                onChange={(e) => {
                  f.onChange(e.target.value);
                  setSaved(false);
                }}
                className={inputClass}
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[#F0F0F1] pt-3.5">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex items-center gap-2 rounded-md bg-[#FF1F8F] py-2.5 pr-5 pl-4 text-sm font-extrabold text-white hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60"
          >
            <MaterialIcon name="bolt" size={18} weight={500} />
            {saving ? "Saving…" : "Save Goals"}
          </button>
          {saved && <span className="text-sm font-semibold text-[#2f7a00]">Saved</span>}
          {error && <span className="text-sm font-semibold text-[#D10A6E]">{error}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-[#F0F0F1] bg-white p-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)] sm:p-5.5">
        <div className="flex flex-col gap-1">
          <span className="text-xl font-black tracking-[-0.02em]">Reset Progress</span>
          <span className="text-[13px] font-semibold text-[#4a4a48]">
            Start your progress over. Followers and Revenue go back to empty and the Posts count starts from today.
            Your goals and the goal date stay the same.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            className="flex h-10 items-center gap-1.5 rounded-md border border-[#E4E4E2] px-4 text-[13.5px] font-bold hover:border-[#0D0D0D]"
          >
            <MaterialIcon name="restart_alt" size={17} />
            Reset progress
          </button>
          {resetDone && <span className="text-sm font-semibold text-[#2f7a00]">Progress reset</span>}
        </div>
      </div>

      {confirmingReset && (
        <ActionDialog
          title="Reset your progress?"
          onClose={() => setConfirmingReset(false)}
          confirmLabel="Reset progress"
          onConfirm={handleReset}
        >
          <div className="px-6 py-4 text-sm font-medium text-[#4a4a48]">
            Followers and Revenue go back to empty, and the Posts count starts over from today. Your goals and goal
            date stay the same. Posts you already marked as Posted are not deleted.
          </div>
        </ActionDialog>
      )}
    </div>
  );
}
