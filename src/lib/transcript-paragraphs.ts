// Splits a transcript into readable paragraphs. If the text already has blank
// lines between paragraphs, those are kept; otherwise every 3 sentences.
export function toParagraphs(transcript: string): string[] {
  const text = transcript.trim();
  if (!text) return [];
  const existing = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (existing.length > 1) return existing;
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)/g) ?? [text];
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 3) {
    paragraphs.push(sentences.slice(i, i + 3).join("").trim());
  }
  return paragraphs;
}
