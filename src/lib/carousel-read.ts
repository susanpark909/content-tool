import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { extractHookBodyCta } from "@/lib/reel-hook-extraction";
import { saveSlidePermanently } from "@/lib/reel-thumbnail";

export type Slide = { url: string; text?: string };

const MAX_SLIDES = 20;

const SlidesSchema = z.object({
  slides: z.array(z.string()).describe("The text on each slide, in order, one entry per slide. An empty string for a slide with no text."),
});

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

// Reads the text off every slide of a carousel with one small-model call, then stores it slide by slide.
// The joined text is saved as the transcript, so hooks, tags and the Hook Vault work the same as for reels.
export async function readCarouselSlides(reelId: string): Promise<void> {
  const supabase = await createClient();
  const { data: reel } = await supabase.from("ct_reels").select("id, short_code, caption, slides, transcript, transcription_status, post_type").eq("id", reelId).single();
  if (!reel || reel.post_type !== "carousel") return;
  if (reel.transcription_status === "ready" || reel.transcription_status === "processing") return;
  const stored = ((reel.slides as Slide[] | null) ?? []).slice(0, MAX_SLIDES);
  if (stored.length === 0) return;

  const { data: locked } = await supabase.from("ct_reels").update({ transcription_status: "processing" }).eq("id", reelId).or("transcription_status.is.null,transcription_status.neq.processing").select("id").maybeSingle();
  if (!locked) return;

  try {
    const slides = await persistSlides(reel.short_code as string, stored);
    const client = getAnthropicClient();
    const response = await client.messages.parse({
      model: "claude-haiku-5-5",
      max_tokens: 3000,
      output_config: { format: zodOutputFormat(SlidesSchema) },
      messages: [
        {
          role: "user",
          content: [
            ...slides.flatMap((s, i) => [
              { type: "text" as const, text: `Slide ${i + 1}:` },
              { type: "image" as const, source: { type: "url" as const, url: s.url } },
            ]),
            {
              type: "text" as const,
              text: `These are the ${slides.length} slides of an Instagram carousel, in order. Write out the text on each slide exactly as it appears (verbatim, with sensible line breaks), without describing the pictures. Return exactly ${slides.length} entries, one per slide; use an empty string for a slide with no text.`,
            },
          ],
        },
      ],
    });
    const texts = response.parsed_output?.slides ?? [];
    const withText = slides.map((s, i) => ({ ...s, text: (texts[i] ?? "").trim() }));
    const transcript = withText.map((s) => s.text).filter(Boolean).join("\n\n");
    await supabase.from("ct_reels").update({ slides: withText, transcript: transcript || null, transcription_status: transcript ? "ready" : "failed" }).eq("id", reelId);
    if (transcript) await extractHookBodyCta(reelId);
  } catch (e) {
    console.error("carousel read failed", e);
    await supabase.from("ct_reels").update({ transcription_status: "failed" }).eq("id", reelId);
  }
}
