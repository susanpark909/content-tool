// The short text a list row shows for a post: the opening lines of the transcript once it has been analyzed
// (that is its hook), and the caption's opening until then. Always a short piece, never the whole thing.
export function previewOf(transcriptionStatus: string | null, hook: string | null, caption: string | null): string {
  const pick = transcriptionStatus === "ready" && hook && hook.trim() ? hook : (caption ?? "");
  const flat = pick.replace(/\s+/g, " ").trim();
  if (flat.length <= 160) return flat;
  const cut = flat.lastIndexOf(" ", 160);
  return flat.slice(0, cut > 80 ? cut : 160).trim();
}
