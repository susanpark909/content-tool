// Server errors are hidden in the live site (React shows "Minified React error #441"). That nearly always means the
// server call failed, and for the AI features the usual cause is the Claude credit balance running out.
export function friendlyError(e: unknown, fallback: string): string {
  const m = e instanceof Error ? e.message : "";
  if (/Server Components render|Minified React error #441/i.test(m)) {
    return "There was an error and it's been reported. Please try again in a few minutes.";
  }
  return m || fallback;
}
