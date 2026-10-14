import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetch-all";
import { getAnthropicClient } from "@/lib/anthropic";
import { syncInstagram } from "@/lib/instagram-api";
import { syncStripe } from "@/lib/stripe-sales";

export type MyReel = {
  id: string;
  permalink: string | null;
  caption: string | null;
  thumbnailUrl: string | null;
  postedAt: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  avgWatchSeconds: number | null;
  follows: number | null;
  lengthSeconds: number | null;
  // how this reel did against your own average: 1.0x is average
  viewsScore: number | null;
  commentsScore: number | null;
  // the ranked signals, each per view
  sharesPerView: number | null;
  watchPct: number | null;
  savesPerView: number | null;
  commentsPerView: number | null;
};

const per = (n: number | null, views: number | null) => (n != null && views != null && views > 0 ? n / views : null);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export async function loadMyReels(): Promise<MyReel[]> {
  const supabase = await createClient();
  const { data } = await fetchAll((from, to) =>
    supabase
      .from("ct_my_reels")
      .select("ig_media_id, short_code, permalink, caption, thumbnail_url, posted_at, views, likes, comments, shares, saves, avg_watch_seconds, follows")
      .order("posted_at", { ascending: false })
      .range(from, to),
  );
  // the length of a reel isn't in Instagram's API; if you've also analyzed it in the Library, that length is used
  const codes = data.map((r) => r.short_code as string | null).filter((c): c is string => !!c);
  const lengthByCode = new Map<string, number>();
  for (let i = 0; i < codes.length; i += 100) {
    const { data: lens } = await supabase.from("ct_reels").select("short_code, duration_seconds").in("short_code", codes.slice(i, i + 100));
    (lens ?? []).forEach((l) => l.duration_seconds != null && lengthByCode.set(l.short_code as string, Number(l.duration_seconds)));
  }
  const avgViews = avg(data.map((r) => r.views as number | null).filter((v): v is number => v != null && v > 0));
  const avgRate = avg(data.map((r) => per(r.comments as number | null, r.views as number | null)).filter((v): v is number => v != null));
  return data.map((r) => {
    const views = r.views as number | null;
    const comments = r.comments as number | null;
    const length = r.short_code ? (lengthByCode.get(r.short_code as string) ?? null) : null;
    const watch = r.avg_watch_seconds != null ? Number(r.avg_watch_seconds) : null;
    const rate = per(comments, views);
    return {
      id: r.ig_media_id as string,
      permalink: r.permalink as string | null,
      caption: r.caption as string | null,
      thumbnailUrl: r.thumbnail_url as string | null,
      postedAt: r.posted_at as string | null,
      views,
      likes: r.likes as number | null,
      comments,
      shares: r.shares as number | null,
      saves: r.saves as number | null,
      avgWatchSeconds: watch,
      follows: r.follows as number | null,
      lengthSeconds: length,
      viewsScore: views != null && avgViews ? views / avgViews : null,
      commentsScore: rate != null && avgRate ? rate / avgRate : null,
      sharesPerView: per(r.shares as number | null, views),
      watchPct: watch != null && length ? Math.min(1, watch / length) : null,
      savesPerView: per(r.saves as number | null, views),
      commentsPerView: rate,
    };
  });
}

export async function totalRevenueCents(): Promise<number> {
  const supabase = await createClient();
  const { data } = await fetchAll((from, to) => supabase.from("ct_sales").select("amount_cents").order("occurred_at").range(from, to));
  return data.reduce((s, r) => s + Number(r.amount_cents ?? 0), 0);
}

const GOALS_ID = "00000000-0000-0000-0000-000000000001";

// Pulls fresh numbers from everything that's connected, saves today's snapshot for the growth charts,
// and feeds the Followers and Revenue progress on the Home page.
export async function syncEverything(): Promise<{ instagram?: string; stripe?: string }> {
  const supabase = await createClient();
  const { data: conns } = await supabase.from("ct_connections").select("provider, status");
  const connected = new Set((conns ?? []).filter((c) => c.status !== "disconnected").map((c) => c.provider as string));
  const result: { instagram?: string; stripe?: string } = {};
  let followers: number | null = null;
  if (connected.has("instagram")) {
    try {
      const r = await syncInstagram();
      followers = r.followers;
      result.instagram = `${r.reels} reels`;
    } catch (e) {
      result.instagram = e instanceof Error ? e.message : "failed";
    }
  }
  let revenueCents: number | null = null;
  if (connected.has("stripe")) {
    try {
      const r = await syncStripe();
      result.stripe = `${r.sales} sales`;
    } catch (e) {
      result.stripe = e instanceof Error ? e.message : "failed";
    }
  }
  if (connected.has("stripe")) revenueCents = await totalRevenueCents();
  const day = new Date().toISOString().slice(0, 10);
  if (followers != null || revenueCents != null) {
    await supabase.from("ct_daily_stats").upsert({ day, ...(followers != null ? { followers } : {}), ...(revenueCents != null ? { revenue_cents: revenueCents } : {}) }, { onConflict: "day" });
    const goalUpdate: Record<string, number> = {};
    if (followers != null) goalUpdate.current_followers = followers;
    if (revenueCents != null) goalUpdate.current_revenue = Math.round(revenueCents / 100);
    if (Object.keys(goalUpdate).length > 0) await supabase.from("ct_goals").update(goalUpdate).eq("id", GOALS_ID);
  }
  return result;
}

// One short plain-English summary of the last week, written by Claude from your real numbers.
export async function writeWeeklySummary(reels: MyReel[]): Promise<string | null> {
  const week = Date.now() - 7 * 24 * 3600 * 1000;
  const recent = reels.filter((r) => r.postedAt && new Date(r.postedAt).getTime() >= week);
  const best = [...reels].filter((r) => r.viewsScore != null).sort((a, b) => (b.viewsScore ?? 0) - (a.viewsScore ?? 0)).slice(0, 3);
  if (reels.length < 3) return null;
  const line = (r: MyReel) =>
    `"${(r.caption ?? "").replace(/\s+/g, " ").slice(0, 90)}" views ${r.views ?? "?"}, ${r.viewsScore?.toFixed(1) ?? "?"}x your average, comments ${r.comments ?? "?"}, shares ${r.shares ?? "?"}, saves ${r.saves ?? "?"}, follows ${r.follows ?? "?"}`;
  const prompt = `You are writing a short weekly summary for a creator about her own Instagram reels. Plain, warm, specific. 3 or 4 sentences, no bullet points, no headings.\n\nReels posted in the last 7 days (${recent.length}):\n${recent.map(line).join("\n") || "none"}\n\nHer best reels of all time:\n${best.map(line).join("\n")}\n\nSay what stood out this week, what her best reels have in common, and one thing to do next. Use only these numbers.`;
  const client = getAnthropicClient();
  const res = await client.messages.create({ model: "claude-haiku-5-5", max_tokens: 400, messages: [{ role: "user", content: prompt }] });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  const supabase = await createClient();
  await supabase.from("ct_ai_usage").insert({ kind: "weekly-summary", input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens });
  if (text) await supabase.from("ct_performance_summary").insert({ summary: text });
  return text || null;
}
