"use server";

import { createClient } from "@/lib/supabase/server";
import { OPERATION_LABEL } from "@/lib/scraper-health";

export type ScraperAlert = { level: "backup" | "down"; text: string };

// Looks at the last half hour of data-source attempts. "down": the newest attempt for something failed on every source.
// "backup": the main source failed but a backup answered, so things still work with a few details missing.
export async function getScraperStatus(): Promise<ScraperAlert[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data } = await supabase.from("ct_scraper_events").select("operation, ok, fallback, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(200);
  const alerts: ScraperAlert[] = [];
  const seen = new Set<string>();
  for (const e of data ?? []) {
    const op = e.operation as string;
    if (seen.has(op)) continue;
    seen.add(op);
    const label = OPERATION_LABEL[op] ?? op;
    if (!e.ok) alerts.push({ level: "down", text: `${label} isn't working right now. It was retried and the backup was tried too.` });
    else if (e.fallback) alerts.push({ level: "backup", text: `${label} is running on the backup source, so shares, saves and a few other details may be missing for now.` });
  }
  return alerts;
}
