import { createClient } from "@/lib/supabase/server";
import { saveSlidePermanently } from "@/lib/reel-thumbnail";
import { getAnthropicClient } from "@/lib/anthropic";

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
// within days) and the post is marked done. Only the first slide is read by the AI (its text is the carousel's hook); a carousel has no transcript.
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
    await readCarouselHook(reelId);
  } catch (e) {
    console.error("carousel save failed", e);
    await supabase.from("ct_reels").update({ transcription_status: "ready", created_at: new Date().toISOString() }).eq("id", reelId);
  }
}

// A carousel's hook is the text on screen on its first slide. One small-model look at that one picture (the cheapest
// model, Haiku): the other slides are never read. Fails soft; a carousel just keeps no hook if this doesn't work.
export async function readCarouselHook(reelId: string): Promise<void> {
  const supabase = await createClient();
  const { data: reel } = await supabase.from("ct_reels").select("id, slides, hook_text, post_type").eq("id", reelId).single();
  if (!reel || reel.post_type !== "carousel" || (reel.hook_text as string | null)?.trim()) return;
  const slides = (reel.slides as Slide[] | null) ?? [];
  const first = slides[0];
  if (!first?.url) return;
  try {
    const response = await getAnthropicClient().messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            { type: "image" as const, source: { type: "url" as const, url: first.url } },
            { type: "text" as const, text: "This is the first slide of an Instagram carousel. Write out the text on the slide exactly as it appears (verbatim, with sensible line breaks), without describing the picture. If the slide has no text, answer NONE." },
          ],
        },
      ],
    });
    await supabase.from("ct_ai_usage").insert({ kind: "hook", input_tokens: response.usage?.input_tokens ?? 0, output_tokens: response.usage?.output_tokens ?? 0 });
    const block = response.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    if (!text || /^none.?$/i.test(text)) return;
    await supabase.from("ct_reels").update({ hook_text: text, slides: [{ ...first, text }, ...slides.slice(1)] }).eq("id", reelId);
  } catch (e) {
    console.error("carousel hook failed", e);
  }
}
