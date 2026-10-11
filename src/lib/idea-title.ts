// An idea's title follows its script: it is the opening of the script, the first sentence (or the first line,
// for scripts written without full stops). A very short first sentence takes the next one too.
// It is never cut off with dots: if it has to be shortened, it ends at a word.
export function titleFromScript(body: string): string {
  const parts = body
    .split(/(?:(?<=[.!?])\s+)|\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  let title = parts[0];
  if (title.length < 60 && parts[1]) title = `${title} ${parts[1]}`;
  title = title.replace(/\s+/g, " ").trim();
  if (title.length > 140) {
    const cut = title.lastIndexOf(" ", 140);
    title = title.slice(0, cut > 70 ? cut : 140).trim();
  }
  return title;
}
