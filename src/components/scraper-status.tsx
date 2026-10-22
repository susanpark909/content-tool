"use client";

import { useEffect, useState } from "react";
import { getScraperStatus, type ScraperAlert } from "@/app/scraper-status-actions";
import { MaterialIcon } from "@/components/ui/material-icon";

// A thin bar at the top that only shows when a data source is failing or a backup has taken over, so a problem is
// seen the moment it happens instead of when someone reports it.
export function ScraperStatus() {
  const [alerts, setAlerts] = useState<ScraperAlert[]>([]);
  useEffect(() => {
    let alive = true;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      getScraperStatus()
        .then((a) => alive && setAlerts(a))
        .catch(() => {});
    };
    check();
    const timer = setInterval(check, 120_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  if (alerts.length === 0) return null;
  const down = alerts.some((a) => a.level === "down");
  return (
    <div className={`flex items-start gap-2 px-4 py-2.5 text-[13px] font-bold md:px-8 ${down ? "bg-[#FFF0F7] text-[#D10A6E]" : "bg-[#FFF7D6] text-[#7a5a00]"}`}>
      <MaterialIcon name={down ? "error" : "info"} size={18} className="mt-px flex-none" />
      <span className="flex min-w-0 flex-col gap-0.5">
        {alerts.map((a) => (
          <span key={a.text}>{a.text}</span>
        ))}
      </span>
    </div>
  );
}
