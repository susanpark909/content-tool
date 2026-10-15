import { createClient } from "@/lib/supabase/server";
import { saveSlidePermanently } from "@/lib/reel-thumbnail";

export type Slide = { url: string; text?: string };

const MAX_SLIDES = 20;

// Saves every slide picture permanently (a few at a time), keeping the original link if one can't be saved.
export async function persistSlides(code: string, slides: Slide[]): Promise<Slide[]> {
  const out: Slide[] = [];
  for (let i = 0; i < slides.length; i += 5) {
    const part = await Promise.all(
      slides.slice(i, i + 5).map(async (s, j) => {
        if (s.url.includes("supabase.co")) return s;
        const saved = await saveSlidePermanently(s.url, code, i + j);
        return { ...s, url: saved ?? s.url };
      }),
    );
    out.push(...part);
  }
  return out;
}

// "Analyzing" a carousel keeps its slide pictures: they are saved permanently (Instagram's own picture links expire
// within days) and the post is marked done. The slides are not read by the AI, so a carousel has no transcript.
export async function readCarouselSlides(reelId: string): Promise<void> {
  const supabase = await createClient();
  const { data: reel } = await supabase.from("ct_reels").select("id, short_code, slides, transcription_status, post_type").eq("id", reelId).single();
  if (!reel || reel.post_type !== "carousel") return;
  if (reel.transcription_status === "ready") return;
  const stored = ((reel.slides as Slide[] | null) ?? []).slice(0, MAX_SLIDES);
  try {
    const slides = stored.length > 0 ? await persistSlides(reel.short_code as string, stored) : stored;
    await supabase
      .from("ct_reels")
      .update({ ...(slides.length > 0 ? { slides } : {}), transcription_status: "ready", transcription_id: null, transcription_error: null, created_at: new Date().toISOString() })
      .eq("id", reelId);
  } catch (e) {
    console.error("carousel save failed", e);
    await supabase.from("ct_reels").update({ transcription_status: "ready", created_at: new Date().toISOString() }).eq("id", reelId);
  }
}
