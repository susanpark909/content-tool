// The title a list row shows for a post: its hook once it has been analyzed, and until then the caption's
// first sentence or two. Always a short piece, never the whole thing.
const MAX = 160;

function shorten(flat: string): string {
  if (flat.length <= MAX) return flat;
  const cut = flat.lastIndexOf(" ", MAX);
  return flat.slice(0, cut > 80 ? cut : MAX).trim();
}

function firstSentences(flat: string): string {
  const sentences = flat.match(/[^.!?]+[.!?]+(?=\s|$)/g)?.map((s) => s.trim()) ?? [];
  if (sentences.length === 0) return shorten(flat);
  // one sentence when it already carries the point, two when the first is only a few words
  const out = sentences[0].length >= 40 || sentences.length < 2 ? sentences[0] : sentences[0] + " " + sentences[1];
  return shorten(out);
}

export function previewOf(transcriptionStatus: string | null, hook: string | null, caption: string | null): string {
  if (transcriptionStatus === "ready" && hook && hook.trim()) return shorten(hook.replace(/\s+/g, " ").trim());
  return firstSentences((caption ?? "").replace(/\s+/g, " ").trim());
}
