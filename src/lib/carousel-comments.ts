import { runPostDetailsScraper, slideUrlsOf } from "@/lib/apify";

export type CarouselDetails = { comments: number | null; slides: string[] };

// The cheap creator-pull scraper sends no comment count and no slide pictures for carousels (a carousel pulled with it
// would read 0 comments and have nothing to save). This asks the scraper that sends both (about $0.002 a post), a batch
// at a time, and is only ever given carousels that are new to the Library or still have no slides. A carousel it can't
// answer for is left out of the result, and the caller keeps what it had.
export async function fetchCarouselDetails(codes: string[]): Promise<Map<string, CarouselDetails>> {
  const out = new Map<string, CarouselDetails>();
  for (let i = 0; i < codes.length; i += 40) {
    try {
      const items = await runPostDetailsScraper({ postUrls: codes.slice(i, i + 40).map((c) => `https://www.instagram.com/p/${c}/`) });
      for (const it of items) {
        if (!it.code || it.partial) continue;
        out.set(it.code, { comments: typeof it.comment_count === "number" ? it.comment_count : null, slides: slideUrlsOf(it) });
      }
    } catch {
      // comments and slides stay as they were
    }
  }
  return out;
}
