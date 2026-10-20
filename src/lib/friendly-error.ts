// Server errors are hidden in the live site (React shows "Minified React error #441"). That nearly always means the
// server call failed, and for the AI features the usual cause is the Claude credit balance running out.
export function friendlyError(e: unknown, fallback: string): string {
  const m = e instanceof Error ? e.message : "";
  if (/Server Components render|Minified React error #441/i.test(m)) {
    return "That didn't go through. Try again in a minute. If it keeps happening, check your Claude credits in the Anthropic Console and your Instagram scraper usage on Apify.";
  }
  return m || fallback;
}
