// An idea's title follows its script: it is the opening of the script, the first sentence or two.
// (Lines count as sentences too, so a script written without full stops still gets a sensible title.)
export function titleFromScript(body: string): string {
  const parts = body
    .split(/(?:(?<=[.!?])\s+)|\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 2);
  let title = parts.join(" ").replace(/\s+/g, " ").trim();
  if (title.length > 200) {
    title = title.slice(0, 200);
    const cut = title.lastIndexOf(" ");
    if (cut > 120) title = title.slice(0, cut);
    title = title.trim() + "…";
  }
  return title;
}
