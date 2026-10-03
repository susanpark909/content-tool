"use client";

import { useEffect, useState } from "react";

type TabKey = "profile" | "goals";

// Settings sections as tabs: the brand/audience area and the Goals area.
export function SettingsTabs({ profile, goals }: { profile: React.ReactNode; goals: React.ReactNode }) {
  const [tab, setTab] = useState<TabKey>("profile");

  useEffect(() => {
    try {
      if (sessionStorage.getItem("rc-settings-tab") === "goals") setTab("goals");
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
    { key: "goals", label: "Goals" },
  ];

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex gap-1 self-start rounded-lg bg-[#F6F6F5] p-1">
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
      <div style={{ display: tab === "goals" ? "block" : "none" }}>{goals}</div>
    </div>
  );
}
