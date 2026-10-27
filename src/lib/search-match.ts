// One search rule for every search box: every word you typed must appear somewhere in the text, in any order.
// Quotes and punctuation are ignored, so  Comment “editing”  finds  comment "EDITING" and I'll DM you.
export function searchWords(q: string): string[] {
  return q.toLowerCase().replace(/[^\p{L}\p{N}@.']+/gu, " ").split(" ").filter(Boolean);
}

export function matchesSearch(text: string, q: string): boolean {
  const here = text.toLowerCase();
  return searchWords(q).every((w) => here.includes(w));
}
