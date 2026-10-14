import { createClient } from "@/lib/supabase/server";

// Your own Instagram, through Instagram's official API (Instagram Login). This is the only way to get the numbers
// the public scrapers can't see: shares, saves, how long people watch, and follows from each reel.
// It needs a Meta app (META_APP_ID / META_APP_SECRET) and your Instagram Business or Creator account.
const GRAPH = "https://graph.instagram.com/v21.0";
const SCOPES = "instagram_business_basic,instagram_business_manage_insights";

export const igConfigured = () => !!process.env.META_APP_ID && !!process.env.META_APP_SECRET;

export function igAuthUrl(redirectUri: string, state: string) {
  const p = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: redirectUri,
    scope: SCOPES,
    response_type: "code",
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${p.toString()}`;
}

// Trades the one-time code for a long-lived token (good for about 60 days; it is refreshed on each sync).
export async function igExchangeCode(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });
  const short = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body });
  if (!short.ok) throw new Error(`Instagram didn't accept the sign-in (${short.status}).`);
  const sj = (await short.json()) as { access_token?: string; user_id?: number | string };
  if (!sj.access_token) throw new Error("Instagram didn't send an access token.");
  const longRes = await fetch(
    `${GRAPH.replace("/v21.0", "")}/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(process.env.META_APP_SECRET ?? "")}&access_token=${encodeURIComponent(sj.access_token)}`,
  );
  if (!longRes.ok) throw new Error(`Couldn't get a long-lasting Instagram token (${longRes.status}).`);
  const lj = (await longRes.json()) as { access_token?: string; expires_in?: number };
  return { token: lj.access_token ?? sj.access_token, userId: String(sj.user_id ?? ""), expiresInSec: lj.expires_in ?? 60 * 24 * 3600 };
}

async function get<T>(path: string, token: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH}${path}${sep}access_token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(`Instagram said ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return (await res.json()) as T;
}

type Media = { id: string; caption?: string; media_product_type?: string; permalink?: string; timestamp?: string; thumbnail_url?: string; media_url?: string; like_count?: number; comments_count?: number };

// One call per metric group, falling back to single metrics, because Instagram refuses the whole request when one
// metric isn't available for a post.
async function insightsFor(id: string, token: string): Promise<Record<string, number>> {
  const metrics = ["views", "reach", "saved", "shares", "ig_reels_avg_watch_time", "ig_reels_video_view_total_time", "follows"];
  const out: Record<string, number> = {};
  const read = (j: { data?: { name: string; values?: { value?: number }[]; total_value?: { value?: number } }[] }) => {
    for (const m of j.data ?? []) {
      const v = m.total_value?.value ?? m.values?.[0]?.value;
      if (typeof v === "number") out[m.name] = v;
    }
  };
  try {
    read(await get(`/${id}/insights?metric=${metrics.join(",")}`, token));
    return out;
  } catch {
    // fall through to one at a time
  }
  for (const m of metrics) {
    try {
      read(await get(`/${id}/insights?metric=${m}`, token));
    } catch {
      // this metric isn't available for this post
    }
  }
  return out;
}

export async function syncInstagram(): Promise<{ reels: number; followers: number | null }> {
  const supabase = await createClient();
  const { data: conn } = await supabase.from("ct_connections").select("access_token, token_expires_at").eq("provider", "instagram").maybeSingle();
  if (!conn?.access_token) throw new Error("Instagram isn't connected yet.");
  let token = conn.access_token as string;

  // keep the 60-day token alive
  const expires = conn.token_expires_at ? new Date(conn.token_expires_at as string).getTime() : 0;
  if (expires && expires - Date.now() < 10 * 24 * 3600 * 1000) {
    try {
      const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
      if (r.ok) {
        const j = (await r.json()) as { access_token?: string; expires_in?: number };
        if (j.access_token) {
          token = j.access_token;
          await supabase
            .from("ct_connections")
            .update({ access_token: token, token_expires_at: new Date(Date.now() + (j.expires_in ?? 5184000) * 1000).toISOString() })
            .eq("provider", "instagram");
        }
      }
    } catch {
      // the next sync tries again
    }
  }

  try {
    const me = await get<{ username?: string; followers_count?: number }>("/me?fields=username,followers_count", token);
    const followers = typeof me.followers_count === "number" ? me.followers_count : null;

    const media: Media[] = [];
    let next: string | null = "/me/media?fields=id,caption,media_product_type,permalink,timestamp,thumbnail_url,media_url,like_count,comments_count&limit=50";
    for (let page = 0; next && page < 4; page++) {
      const j: { data?: Media[]; paging?: { next?: string } } = await get(next, token);
      media.push(...(j.data ?? []));
      next = j.paging?.next ? j.paging.next.replace(/^https:\/\/graph\.instagram\.com\/v[\d.]+/, "").replace(/([?&])access_token=[^&]*&?/, "$1") : null;
    }

    const reels = media.filter((m) => m.media_product_type === "REELS");
    const rows = [];
    for (const m of reels) {
      const ins = await insightsFor(m.id, token);
      rows.push({
        ig_media_id: m.id,
        short_code: m.permalink?.match(/\/(?:reel|p)\/([A-Za-z0-9_-]+)/)?.[1] ?? null,
        permalink: m.permalink ?? null,
        caption: m.caption ?? null,
        thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
        posted_at: m.timestamp ?? null,
        views: ins.views ?? null,
        reach: ins.reach ?? null,
        likes: m.like_count ?? null,
        comments: m.comments_count ?? null,
        shares: ins.shares ?? null,
        saves: ins.saved ?? null,
        avg_watch_seconds: ins.ig_reels_avg_watch_time != null ? ins.ig_reels_avg_watch_time / 1000 : null,
        total_watch_seconds: ins.ig_reels_video_view_total_time != null ? ins.ig_reels_video_view_total_time / 1000 : null,
        follows: ins.follows ?? null,
        synced_at: new Date().toISOString(),
      });
    }
    if (rows.length > 0) {
      const { error } = await supabase.from("ct_my_reels").upsert(rows, { onConflict: "ig_media_id" });
      if (error) throw new Error(error.message);
    }
    await supabase.from("ct_connections").update({ account_name: me.username ? `@${me.username}` : null, last_sync_at: new Date().toISOString(), error: null, status: "connected" }).eq("provider", "instagram");
    return { reels: rows.length, followers };
  } catch (e) {
    await supabase.from("ct_connections").update({ error: e instanceof Error ? e.message : "Couldn't sync Instagram", status: "error" }).eq("provider", "instagram");
    throw e;
  }
}
