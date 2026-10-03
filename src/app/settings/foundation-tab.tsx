"use client";

import { useState, useTransition } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";
import { AutoTextarea } from "@/components/auto-textarea";
import { ActionDialog } from "@/components/action-dialog";
import { findContentTopics, saveFoundation, type Foundation } from "./foundation-actions";

const areaClass =
  "w-full rounded-md border border-[#E4E4E2] bg-white px-3 py-2.5 text-[15px] leading-[1.55] font-medium text-[#0D0D0D] outline-none focus:border-[#0D0D0D]";

export function FoundationTab({ initial }: { initial: Foundation }) {
  const [f, setF] = useState(initial);
  const [saving, startSaving] = useTransition();
  const [finding, startFinding] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof Foundation>(key: K, value: string) {
    setF((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    setError("");
    startSaving(async () => {
      try {
        await saveFoundation(f);
        setSaved(true);
      } catch {
        setError("Couldn't save.");
      }
    });
  }

  const [confirmingRegen, setConfirmingRegen] = useState(false);

  function handleFind() {
    setConfirmingRegen(false);
    setError("");
    startFinding(async () => {
      try {
        const found = await findContentTopics({
          goodAt: f.goodAt,
          loveLearning: f.loveLearning,
          peopleNeed: f.peopleNeed,
          peoplePay: f.peoplePay,
        });
        if (found.length === 0) {
          setError("The AI didn't come back with anything. Try again.");
          return;
        }
        const list = found
          .map((t) => [t.topic, ...t.subtopics.map((x) => `   • ${x}`)].join("\n"))
          .join("\n\n");
        set("overlap", list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const circles: { key: keyof Foundation; title: string; hint: string }[] = [
    { key: "goodAt", title: "What Am I Good At?", hint: "Skills, results, things people come to you for." },
    { key: "loveLearning", title: "What Do I Love Learning?", hint: "Topics you'd read or watch about for fun." },
    { key: "peopleNeed", title: "What Do People Want / Need?", hint: "Their problems, wishes, what they keep asking about." },
    { key: "peoplePay", title: "What Do People Actually Pay For?", hint: "What they spend money on to get solved." },
  ];

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-4 rounded-lg border border-[#F0F0F1] bg-white p-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)] sm:p-5.5">
        <div className="flex flex-col gap-1">
          <span className="text-xl font-black tracking-[-0.02em]">My Ikigai</span>
          <span className="text-[13px] font-semibold text-[#4a4a48]">
            Your brand lives at this intersection.
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {circles.map((c) => (
            <label key={c.key} className="grid grid-cols-1 gap-1.5 md:grid-cols-[250px_minmax(0,1fr)] md:gap-x-4">
              <span className="flex flex-col gap-0.5 md:pt-2">
                <span className="text-[13.5px] font-extrabold">{c.title}</span>
                <span className="text-xs font-medium text-[#4a4a48]">{c.hint}</span>
              </span>
              <AutoTextarea value={f[c.key]} onChange={(v) => set(c.key, v)} minRows={1} collapsible className={areaClass} />
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3.5 rounded-lg border border-[#F0F0F1] bg-white p-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)] sm:p-5.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xl font-black tracking-[-0.02em]">Content Topics</span>
            <span className="text-[13px] font-semibold text-[#4a4a48]">
              4 broad topics, each with 5 sub-topics. Let the AI find them from your Ikigai, then edit freely.
            </span>
          </div>
          <button
            type="button"
            disabled={finding}
            onClick={() => (f.overlap.trim() ? setConfirmingRegen(true) : handleFind())}
            className="flex h-10 flex-none items-center gap-1.5 rounded-md bg-[#FF1F8F] px-4 text-[13.5px] font-extrabold text-white hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60"
          >
            <MaterialIcon name="auto_awesome" size={17} weight={500} />
            {finding ? "Finding…" : "Find Content Topics With AI"}
          </button>
        </div>
        <AutoTextarea
          value={f.overlap}
          onChange={(v) => set("overlap", v)}
          minRows={2} collapsible
          placeholder="Your broad topics, each with sub-topics underneath. Write your own, or let the AI suggest."
          className={areaClass}
        />
      </div>

      <div className="flex flex-col gap-3.5 rounded-lg border border-[#F0F0F1] bg-white p-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)] sm:p-5.5">
        <div className="flex flex-col gap-1">
          <span className="text-xl font-black tracking-[-0.02em]">My Journey</span>
          <span className="text-[13px] font-semibold text-[#4a4a48]">
            What you&apos;ve been through and what you&apos;ve accomplished. Just write.
          </span>
        </div>
        <AutoTextarea value={f.journey} onChange={(v) => set("journey", v)} minRows={2} collapsible className={areaClass} />
      </div>

      <div className="flex flex-col gap-3.5 rounded-lg border border-[#F0F0F1] bg-white p-4 shadow-[0_4px_16px_rgba(13,13,13,0.09)] sm:p-5.5">
        <div className="flex flex-col gap-1">
          <span className="text-xl font-black tracking-[-0.02em]">What I&apos;m For Or Against</span>
          <span className="text-[13px] font-semibold text-[#4a4a48]">
            The beliefs you stand behind, and the things you push back on.
          </span>
        </div>
        <AutoTextarea value={f.forAgainst} onChange={(v) => set("forAgainst", v)} minRows={2} collapsible className={areaClass} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="flex h-11 items-center gap-2 rounded-md bg-[#FF1F8F] px-6 text-sm font-extrabold text-white hover:bg-[#0D0D0D] hover:text-[#FF1F8F] disabled:opacity-60"
        >
          <MaterialIcon name="bolt" size={18} weight={500} />
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-sm font-semibold text-[#2f7a00]">Saved</span>}
        {error && <span className="text-sm font-semibold text-[#D10A6E]">{error}</span>}
      </div>

      {confirmingRegen && (
        <ActionDialog
          title="Regenerate Content Topics?"
          onClose={() => setConfirmingRegen(false)}
          confirmLabel="Regenerate"
          onConfirm={handleFind}
        >
          <div className="px-6 py-4 text-sm font-medium text-[#4a4a48]">
            This replaces everything in your Content Topics box with a brand new set of 4 topics and 5 sub-topics each.
            What&apos;s there now will be deleted.
          </div>
        </ActionDialog>
      )}
    </div>
  );
}
