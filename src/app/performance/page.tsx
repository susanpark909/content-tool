import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/ui/page-shell";
import { loadMyReels, syncEverything, writeWeeklySummary } from "@/lib/performance";
import { PerformanceClient } from "./performance-client";

export const dynamic = "force-dynamic";
// pulling fresh numbers and writing the weekly summary can take a little while
export const maxDuration = 120;

export default async function PerformancePage() {
  const supabase = await createClient();
  const { data: conns } = await supabase.from("ct_connections").select("provider, status, last_sync_at");
  const ig = (conns ?? []).find((c) => c.provider === "instagram" && c.status !== "disconnected");
  const stripe = (conns ?? []).find((c) => c.provider === "stripe" && c.status !== "disconnected");

  // keep the numbers fresh without a button: update when the last pull is over 12 hours old
  const stale = (c: { last_sync_at: unknown } | undefined) => !!c && (!c.last_sync_at || Date.now() - new Date(c.last_sync_at as string).getTime() > 12 * 3600 * 1000);
  if (stale(ig) || stale(stripe)) after(async () => void (await syncEverything().catch(() => {})));

  const reels = ig ? await loadMyReels() : [];

  const { data: summaryRow } = await supabase.from("ct_performance_summary").select("summary, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const summaryAge = summaryRow ? Date.now() - new Date(summaryRow.created_at as string).getTime() : Infinity;
  if (reels.length >= 3 && summaryAge > 7 * 24 * 3600 * 1000) after(async () => void (await writeWeeklySummary(reels).catch(() => null)));

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const { data: daily } = await supabase.from("ct_daily_stats").select("day, followers, revenue_cents").gte("day", since.toISOString().slice(0, 10)).order("day");
  const { data: sales } = await supabase.from("ct_sales").select("amount_cents, occurred_at").gte("occurred_at", since.toISOString());
  const revenue30 = (sales ?? []).reduce((s, r) => s + Number(r.amount_cents ?? 0), 0) / 100;
  const days = daily ?? [];
  const followersNow = [...days].reverse().find((d) => d.followers != null)?.followers ?? null;
  const followersThen = days.find((d) => d.followers != null)?.followers ?? null;

  return (
    <PageShell>
      <div>
        <h1 className="text-[34px] leading-[0.95] font-black tracking-[-0.04em] md:text-[64px]">
          My Performance
          <span className="ml-1 inline-block size-2 rounded-full bg-[#C6FF3D] align-baseline md:size-3" />
        </h1>
        <p className="mt-1 text-[13.5px] font-medium text-[#4a4a48] md:mt-2 md:text-[15px]">How your own reels are doing, and what to do next.</p>
      </div>
      <PerformanceClient
        connected={!!ig}
        salesConnected={!!stripe}
        reels={reels}
        summary={(summaryRow?.summary as string | null) ?? null}
        summaryAt={(summaryRow?.created_at as string | null) ?? null}
        followers={followersNow}
        followerChange={followersNow != null && followersThen != null ? followersNow - followersThen : null}
        revenue30={stripe ? revenue30 : null}
      />
    </PageShell>
  );
}
