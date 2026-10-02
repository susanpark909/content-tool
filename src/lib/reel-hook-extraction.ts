import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";

const ExtractionSchema = z.object({
  hookText: z
    .string()
    .describe(
      "ONLY the first sentence of the transcript, verbatim in wording, formatted with standard sentence capitalization and punctuation. Never two sentences.",
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
- The hook is ALWAYS just the FIRST SENTENCE of the transcript. One sentence only — never two or more, even if the second sentence feels like part of the opener.
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
