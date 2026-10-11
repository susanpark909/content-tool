"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/ui/material-icon";

type TabKey = "profile" | "goals" | "instructions" | "tags";

// Settings sections. Larger screens get tabs; phones get a clean list of sections, tap one to open it.
export function SettingsTabs({
  profile,
  goals,
  instructions,
  tags,
}: {
  profile: React.ReactNode;
  goals: React.ReactNode;
  instructions: React.ReactNode;
  tags: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("profile");
  const [phone, setPhone] = useState(false);
  const [inSection, setInSection] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    try {
      const saved = sessionStorage.getItem("rc-settings-tab");
      if (saved === "goals" || saved === "instructions" || saved === "tags") setTab(saved);
      if (sessionStorage.getItem("rc-settings-in") === "1") setInSection(true);
    } catch {}
    return () => mq.removeEventListener("change", on);
  }, []);

  function pick(next: TabKey) {
    setTab(next);
    try {
      sessionStorage.setItem("rc-settings-tab", next);
    } catch {}
  }
  function enter(next: TabKey) {
    pick(next);
    setInSection(true);
    try {
      sessionStorage.setItem("rc-settings-in", "1");
    } catch {}
    window.scrollTo({ top: 0 });
  }
  function leave() {
    setInSection(false);
    try {
      sessionStorage.setItem("rc-settings-in", "0");
    } catch {}
    window.scrollTo({ top: 0 });
  }

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "profile", label: "Brand & Audience", icon: "person" },
    { key: "goals", label: "Goals", icon: "target" },
    { key: "instructions", label: "Instructions", icon: "description" },
    { key: "tags", label: "Content Types", icon: "category" },
  ];
  const showMenu = phone && !inSection;
  const show = (k: TabKey) => !showMenu && tab === k;

  return (
    <div className="flex flex-col gap-[22px] max-md:gap-4">
      {showMenu && (
        <div className="overflow-hidden rounded-xl border border-[#F0F0F1] bg-white shadow-[0_4px_16px_rgba(13,13,13,0.07)]">
          {tabs.map((t, i) => (
            <button
              key={t.key}
              type="button"
              onClick={() => enter(t.key)}
              className={`flex h-14 w-full items-center gap-3.5 px-4 text-left text-[15px] font-bold text-[#0D0D0D] active:bg-[#F6F6F5] ${i > 0 ? "border-t border-[#F0F0F1]" : ""}`}
            >
              <MaterialIcon name={t.icon} size={22} className="text-[#0D0D0D]" />
              <span className="flex-1">{t.label}</span>
              <MaterialIcon name="chevron_right" size={22} className="text-[#9a9a98]" />
            </button>
          ))}
        </div>
      )}

      {phone && inSection && (
        <button type="button" onClick={leave} className="flex items-center gap-1 self-start text-[13.5px] font-bold text-[#4a4a48]">
          <MaterialIcon name="chevron_left" size={20} /> Settings
        </button>
      )}

      <div className="flex max-w-full gap-1 self-start overflow-x-auto rounded-lg bg-[#F6F6F5] p-1 max-md:hidden">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => pick(t.key)}
            className="flex h-[34px] items-center justify-center rounded-md border px-4 text-[13.5px] font-bold whitespace-nowrap text-[#0D0D0D]"
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
      <div style={{ display: show("profile") ? "block" : "none" }}>{profile}</div>
      <div style={{ display: show("goals") ? "block" : "none" }}>{goals}</div>
      <div style={{ display: show("instructions") ? "block" : "none" }}>{instructions}</div>
      <div style={{ display: show("tags") ? "block" : "none" }}>{tags}</div>
    </div>
  );
}
