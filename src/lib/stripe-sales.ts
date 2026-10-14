import { createClient } from "@/lib/supabase/server";

// Sales from Stripe, read with a read-only (restricted) key that you create yourself in Stripe.
// That key can only look; it can never move money.
const API = "https://api.stripe.com/v1";

async function stripeGet<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(j?.error?.message ?? `Stripe said ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function verifyStripeKey(key: string) {
  await stripeGet("/charges?limit=1", key);
}

type Charge = { id: string; amount: number; amount_captured?: number; amount_refunded?: number; currency: string; created: number; paid: boolean; status: string; description?: string | null };

export async function syncStripe(): Promise<{ sales: number }> {
  const supabase = await createClient();
  const { data: conn } = await supabase.from("ct_connections").select("access_token, last_sync_at").eq("provider", "stripe").maybeSingle();
  if (!conn?.access_token) throw new Error("Stripe isn't connected yet.");
  const key = conn.access_token as string;
  // first time: the last 90 days; after that: since a day before the last sync
  const since = conn.last_sync_at
    ? Math.floor((new Date(conn.last_sync_at as string).getTime() - 24 * 3600 * 1000) / 1000)
    : Math.floor((Date.now() - 90 * 24 * 3600 * 1000) / 1000);
  try {
    const rows: { source: string; external_id: string; amount_cents: number; currency: string; occurred_at: string; description: string | null }[] = [];
    let after: string | null = null;
    for (let page = 0; page < 30; page++) {
      const q: string = `/charges?limit=100&created[gte]=${since}${after ? `&starting_after=${after}` : ""}`;
      const j: { data: Charge[]; has_more: boolean } = await stripeGet(q, key);
      for (const c of j.data) {
        if (!c.paid || c.status !== "succeeded") continue;
        const net = (c.amount_captured ?? c.amount) - (c.amount_refunded ?? 0);
        rows.push({ source: "stripe", external_id: c.id, amount_cents: net, currency: c.currency, occurred_at: new Date(c.created * 1000).toISOString(), description: c.description ?? null });
      }
      if (!j.has_more || j.data.length === 0) break;
      after = j.data[j.data.length - 1].id;
    }
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from("ct_sales").upsert(rows.slice(i, i + 200), { onConflict: "source,external_id" });
      if (error) throw new Error(error.message);
    }
    await supabase.from("ct_connections").update({ last_sync_at: new Date().toISOString(), error: null, status: "connected" }).eq("provider", "stripe");
    return { sales: rows.length };
  } catch (e) {
    await supabase.from("ct_connections").update({ error: e instanceof Error ? e.message : "Couldn't sync Stripe", status: "error" }).eq("provider", "stripe");
    throw e;
  }
}
