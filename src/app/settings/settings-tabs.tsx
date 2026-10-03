"use client";

import { useEffect, useState } from "react";

type TabKey = "profile" | "foundation" | "goals" | "instructions";

// Settings sections as tabs: the brand/audience area and the Goals area.
export function SettingsTabs({
  profile,
  foundation,
  goals,
  instructions,
}: {
  profile: React.ReactNode;
  foundation: React.ReactNode;
  goals: React.ReactNode;
  instructions: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("profile");

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("rc-settings-tab");
      if (saved === "goals" || saved === "instructions" || saved === "foundation") setTab(saved);
    } catch {}
  }, []);

  function pick(next: TabKey) {
    setTab(next);
    try {
      sessionStorage.setItem("rc-settings-tab", next);
    } catch {}
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "profile", label: "Brand & Audience" },
    { key: "foundation", label: "What I Talk About" },
    { key: "goals", label: "Goals" },
    { key: "instructions", label: "Instructions" },
  ];

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex max-w-full gap-1 self-start overflow-x-auto rounded-lg bg-[#F6F6F5] p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => pick(t.key)}
            className="flex h-[34px] items-center rounded-md border px-4 text-[13.5px] font-bold text-[#0D0D0D]"
            style={{
              background: tab === t.key ? "#FFFFFF" : "transparent",
              borderColor: tab === t.key ? "#D9D9D7" : "transparent",
              boxShadow: tab === t.key ? "0 3px 10px rgba(13,13,13,.10)" : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ display: tab === "profile" ? "block" : "none" }}>{profile}</div>
      <div style={{ display: tab === "foundation" ? "block" : "none" }}>{foundation}</div>
      <div style={{ display: tab === "goals" ? "block" : "none" }}>{goals}</div>
      <div style={{ display: tab === "instructions" ? "block" : "none" }}>{instructions}</div>
    </div>
  );
}
