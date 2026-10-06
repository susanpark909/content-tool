// Free, no-scraper info about a reel, read from Instagram's own public page
// (the same preview data Facebook/iMessage use for link cards). It has the
// creator, caption, posted date and a thumbnail - but NOT views, shares,
// reposts, saves or length (those need the paid scraper). Instagram may block
// servers at times, so every caller must treat this as best-effort.
export type PublicReelInfo = {
  username: string | null;
  caption: string | null;
  postedAt: string | null;
  thumbnailUrl: string | null;
};

const UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

function decodeEntities(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function metaContent(html: string, key: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)="${key}"[^>]*?content="([^"]*)"`, "i");
  const m = html.match(re);
  return m ? decodeEntities(m[1]) : null;
}

export async function fetchPublicReelInfo(url: string): Promise<PublicReelInfo | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const ogTitle = metaContent(html, "og:title");
    const ogDesc = metaContent(html, "og:description") ?? metaContent(html, "description");
    const ogImage = metaContent(html, "og:image");
    const ogUrl = metaContent(html, "og:url");
    if (!ogTitle && !ogDesc && !ogImage) return null;

    let username: string | null = null;
    const fromUrl = ogUrl?.match(/instagram\.com\/([A-Za-z0-9._]+)\/(?:reel|p|reels)\//i)?.[1];
    if (fromUrl && !["p", "reel", "reels"].includes(fromUrl.toLowerCase())) username = fromUrl;
    if (!username) username = ogDesc?.match(/ - ([A-Za-z0-9._]+) on /)?.[1] ?? null;

    const caption = ogTitle?.match(/on Instagram: "([\s\S]*)"\s*$/)?.[1]?.trim() || null;

    let postedAt: string | null = null;
    const dateText = ogDesc?.match(/ on ([A-Z][a-z]+ \d{1,2}, \d{4}):/)?.[1];
    if (dateText) {
      const d = new Date(`${dateText} 12:00:00 UTC`);
      if (!Number.isNaN(d.getTime())) postedAt = d.toISOString();
    }

    return { username, caption, postedAt, thumbnailUrl: ogImage };
  } catch {
    return null;
  }
}
