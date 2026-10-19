// Server errors are hidden in the live site (React shows "Minified React error #441"). That nearly always means the
// server call failed, and for the AI features the usual cause is the Claude credit balance running out.
export function friendlyError(e: unknown, fallback: string): string {
  const m = e instanceof Error ? e.message : "";
  if (/Server Components render|Minified React error #441/i.test(m)) {
    return "That didn't go through. If it's an AI feature, your Claude credits may have run out. Top them up in the Anthropic Console, then try again.";
  }
  return m || fallback;
}
