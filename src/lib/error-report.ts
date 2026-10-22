// Writes an error into the internal error log (ct_error_reports) so it can be seen and fixed before anyone has to
// report it. Works anywhere on the server, with or without a signed-in user, and never throws.
export async function reportError(source: string, message: string, extra?: { path?: string; digest?: string }) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    // never keep a secret that a failing request might have echoed back
    const clean = message.replace(/(token|key|apikey|secret)=[^&\s"']+/gi, "$1=hidden").slice(0, 1500);
    await fetch(`${url}/rest/v1/ct_error_reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=minimal" },
      body: JSON.stringify({ source, message: clean, path: extra?.path ?? null, digest: extra?.digest ?? null }),
    });
  } catch {
    // reporting must never break the real work
  }
}
