import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { igExchangeCode } from "@/lib/instagram-api";
import { syncEverything } from "@/lib/performance";

export const maxDuration = 60;

// Instagram sends you back here with a one-time code. We trade it for a long-lasting token and pull your first numbers.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const saved = req.cookies.get("ig_state")?.value;
  const back = (q: string) => {
    const r = NextResponse.redirect(`${origin}${q}`);
    r.cookies.delete("ig_state");
    return r;
  };
  if (!code || !state || !saved || state !== saved) return back("/settings?ig=error");
  try {
    const { token, userId, expiresInSec } = await igExchangeCode(code.replace(/#_$/, ""), `${origin}/api/instagram/callback`);
    const supabase = await createClient();
    const { error } = await supabase.from("ct_connections").upsert(
      { provider: "instagram", status: "connected", account_id: userId, access_token: token, token_expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(), connected_at: new Date().toISOString(), error: null },
      { onConflict: "provider" },
    );
    if (error) throw new Error(error.message);
    await syncEverything().catch(() => {});
    return back("/performance");
  } catch {
    return back("/settings?ig=error");
  }
}
