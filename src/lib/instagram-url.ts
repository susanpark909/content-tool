// The creator's name from whatever was pasted: a profile link (with or without tracking bits like ?igsh=... or ?rpxt=...,
// a trailing slash, or an @) or just the name itself.
export function profileUsername(raw: string): string {
  let s = raw.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  s = s.split(/[/?#\s]/)[0] ?? "";
  return s.replace(/^@/, "").trim();
}
