import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";

const ExtractionSchema = z.object({
  hookText: z
    .string()
    .describe(
      "The hook: the opening thought whose ONLY purpose is to grab attention and make someone stop scrolling. Usually one sentence, sometimes two, and short. It ends the moment the attention-grab is done and the actual content, explanation or introduction begins. Verbatim wording, formatted with standard sentence capitalization and punctuation.",
    ),
  ctaText: z
    .string()
    .nullable()
    .describe(
      "ONLY an explicit instruction telling viewers to take an action (like, share, comment, follow, save, send this to someone, DM, click a link, subscribe...). Taken from the spoken transcript first; if none there, only the CTA part of the caption. If neither contains such an explicit instruction, null. Formatted with standard sentence capitalization and punctuation",
    ),
});

// Plain hook/CTA extraction — no pattern or framework matching, no
// "why it worked" reasoning. Runs automatically the moment a reel's
// transcript is ready.
export async function extractHookBodyCta(reelId: string): Promise<void> {
  const supabase = await createClient();

  const { data: reel, error: reelError } = await supabase
    .from("ct_reels")
    .select("id, caption, transcript, transcription_status")
    .eq("id", reelId)
    .single();

  if (reelError || !reel) return;
  if (reel.transcription_status !== "ready" || !reel.transcript) return;

  try {
    const client = getAnthropicClient();
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: {
        effort: "low",
        format: zodOutputFormat(ExtractionSchema),
      },
      messages: [
        {
          role: "user",
          content: `Pull the hook and the call-to-action out of this short-form Instagram Reel.

Caption:
"""
${reel.caption ?? "(none)"}
"""

Transcript:
"""
${reel.transcript}
"""

Extract two parts as plain text. Do not classify, categorize, or explain anything. Follow these rules exactly:

HOOK
- The hook is the opening thought of the video, and its ONLY job is to grab the viewer's attention — the first thought, "boom", to make them stop scrolling. Nothing more.
- It is almost always the very start of the transcript. It is usually ONE sentence; it can be TWO sentences only when the second sentence is needed to finish the same attention-grabbing thought. It is short — typically under about 25 words, and never more than about 40.
- It stops as soon as the attention-grab is done. Do NOT include what comes after it: explanation, backstory, context, the creator introducing themselves ("I'm Michael, I'm an acupuncturist..."), setting up the topic, or the start of the main content.
- Typical hooks: a bold claim, a surprising statement or number, a provocative question, a "stop doing this" warning, a promise of what the viewer will get, a strong "POV" or "if you..." call-out, a confession, a pain point or a curiosity gap.
- When in doubt, choose the shorter version: if the first sentence already grabs attention, stop there.
- Keep the wording verbatim.

CTA (call-to-action)
- A CTA is ONLY a clear, explicit instruction telling the viewer to DO something: like, share, comment (including "comment the word X"), follow, save, subscribe, send this to someone, DM me, click the link, visit a page, etc.
- Where to look, in this order: (1) If the SPOKEN transcript contains a CTA, copy that one. (2) If the transcript has no CTA but the CAPTION does, use only the CTA part of the caption — just the instruction to the viewer, not the rest of the caption.
- These are NOT CTAs: reflections, closing thoughts, statements about what the creator plans to do or share ("I will be sharing more…"), hopes, summaries, or inspirational wrap-ups. If nobody explicitly tells the viewer to take an action, return null.`,
        },
      ],
    });

    if (!response.parsed_output) return;

    await supabase
      .from("ct_reels")
      .update({
        hook_text: response.parsed_output.hookText,
        cta_text: response.parsed_output.ctaText,
      })
      .eq("id", reelId);
  } catch {
    // Fail soft — a failed extraction shouldn't block the transcript itself
    // from being usable. Leaves hook/body/cta empty for this reel.
  }
}
