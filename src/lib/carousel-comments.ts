import { runPostDetailsScraper } from "@/lib/apify";

// The cheap creator-pull scraper sends no comment count for carousels, so a carousel pulled with it would read 0.
// This asks the scraper that does send comments (about $0.002 a post), a batch at a time, and is only ever given
// carousels that are new to the Library. A carousel it can't answer for is left out of the result, and the caller
// keeps what it had.
export async function fetchCarouselComments(codes: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < codes.length; i += 40) {
    try {
      const items = await runPostDetailsScraper({ postUrls: codes.slice(i, i + 40).map((c) => `https://www.instagram.com/p/${c}/`) });
      for (const it of items) if (it.code && !it.partial && typeof it.comment_count === "number") out.set(it.code, it.comment_count);
    } catch {
      // comments stay as they were
    }
  }
  return out;
}
