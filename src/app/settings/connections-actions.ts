"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { igConfigured } from "@/lib/instagram-api";
import { verifyStripeKey } from "@/lib/stripe-sales";
import { syncEverything, loadMyReels, writeWeeklySummary } from "@/lib/performance";

export type ConnectionState = {
  provider: string;
  status: "connected" | "error" | "disconnected";
  accountName: string | null;
  lastSyncAt: string | null;
  error: string | null;
};

export async function getConnections(): Promise<{ connections: ConnectionState[]; instagramReady: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase.from("ct_connections").select("provider, status, account_name, last_sync_at, error");
  return {
    connections: (data ?? []).map((c) => ({
      provider: c.provider as string,
      status: (c.status as ConnectionState["status"]) ?? "connected",
      accountName: (c.account_name as string | null) ?? null,
      lastSyncAt: (c.last_sync_at as string | null) ?? null,
      error: (c.error as string | null) ?? null,
    })),
    instagramReady: igConfigured(),
  };
}

// The key is checked against Stripe before it is saved.
export async function connectStripe(key: string): Promise<{ ok: boolean; error?: string }> {
  const clean = key.trim();
  if (!/^(rk|sk)_(live|test)_/.test(clean)) return { ok: false, error: "That doesn't look like a Stripe key. It should start with rk_live_ (a restricted key)." };
  try {
    await verifyStripeKey(clean);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Stripe didn't accept that key." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_connections")
    .upsert({ provider: "stripe", status: "connected", account_name: "Stripe", access_token: clean, connected_at: new Date().toISOString(), error: null, last_sync_at: null }, { onConflict: "provider" });
  if (error) return { ok: false, error: error.message };
  await syncEverything().catch(() => {});
  revalidatePath("/settings");
  revalidatePath("/performance");
  revalidatePath("/");
  return { ok: true };
}

export async function disconnectProvider(provider: string) {
  const supabase = await createClient();
  await supabase.from("ct_connections").delete().eq("provider", provider);
  revalidatePath("/settings");
  revalidatePath("/performance");
}

export async function syncNow(): Promise<{ instagram?: string; stripe?: string }> {
  const res = await syncEverything();
  revalidatePath("/settings");
  revalidatePath("/performance");
  revalidatePath("/");
  return res;
}

export async function refreshSummary(): Promise<string | null> {
  const reels = await loadMyReels();
  const text = await writeWeeklySummary(reels);
  revalidatePath("/performance");
  return text;
}
