// Writes an error into the internal error log (ct_error_reports) so it can be seen and fixed before anyone has to
// report it, and emails the owner the moment it happens (once the email keys are set). Works anywhere on the server,
// with or without a signed-in user, and never throws.
const recentlyEmailed = new Map<string, number>();

async function emailOwner(source: string, message: string, path?: string) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;
  if (!key || !to) return;
  // the same error repeating is one email, not fifty
  const sig = `${source}:${message.slice(0, 120)}`;
  const last = recentlyEmailed.get(sig) ?? 0;
  if (Date.now() - last < 30 * 60 * 1000) return;
  recentlyEmailed.set(sig, Date.now());
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: "Viral Heist Alerts <onboarding@resend.dev>",
      to: [to],
      subject: `Viral Heist error: ${source}`,
      text: `${message}\n\n${path ? `Page: ${path}\n` : ""}Time: ${new Date().toISOString()}\n\nFull log: https://viralheist.com/internal`,
    }),
  });
}

export async function reportError(source: string, message: string, extra?: { path?: string; digest?: string }) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    // never keep a secret that a failing request might have echoed back
    const clean = message.replace(/(token|key|apikey|secret)=[^&\s"']+/gi, "$1=hidden").slice(0, 1500);
    if (url && key) {
      await fetch(`${url}/rest/v1/ct_error_reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=minimal" },
        body: JSON.stringify({ source, message: clean, path: extra?.path ?? null, digest: extra?.digest ?? null }),
      });
    }
    await emailOwner(source, clean, extra?.path);
  } catch {
    // reporting must never break the real work
  }
}
