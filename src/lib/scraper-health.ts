import { createClient } from "@/lib/supabase/server";

// Every attempt at a data source (Apify scraper) is written down, so the app can tell when one is failing,
// show a warning, and see that a backup took over. Writing never blocks or breaks the real work.
export async function logScraperEvent(e: { operation: string; provider: string; ok: boolean; fallback: boolean; ms: number; error?: string }) {
  try {
    const supabase = await createClient();
    await supabase.from("ct_scraper_events").insert({
      operation: e.operation,
      provider: e.provider,
      ok: e.ok,
      fallback: e.fallback,
      ms: Math.round(e.ms),
      error: e.error ? e.error.slice(0, 400) : null,
    });
  } catch {
    // health tracking is best effort
  }
}

export const OPERATION_LABEL: Record<string, string> = {
  "post-details": "Looking up a post",
  "profile-reels": "Pulling a creator's reels",
  carousels: "Pulling a creator's carousels",
};
