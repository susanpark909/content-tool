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
  bodyText: z
    .string()
    .describe(
      "Everything after the hook's first sentence up to the call-to-action (or to the very end if there is no call-to-action) — verbatim or lightly condensed if the transcript is long, formatted with standard sentence capitalization and punctuation",
    ),
  ctaText: z
    .string()
    .nullable()
    .describe(
      "ONLY an explicit instruction telling viewers to take an action (like, share, comment, follow, save, send this to someone, DM, click a link, subscribe...). If the video and caption contain no such explicit instruction, null. Formatted with standard sentence capitalization and punctuation",
    ),
});

// Plain hook/body/CTA extraction — no pattern or framework matching, no
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
          content: `Split this short-form Instagram Reel's script into its hook, body, and call-to-action.

Caption:
"""
${reel.caption ?? "(none)"}
"""

Transcript:
"""
${reel.transcript}
"""

Extract three parts as plain text. Do not classify, categorize, or explain anything. Follow these rules exactly:

HOOK
- The hook is ALWAYS just the FIRST SENTENCE of the transcript. One sentence only — never two or more, even if the second sentence feels like part of the opener.
- Keep the wording verbatim.

BODY
- Everything after that first sentence, up to the call-to-action (or to the end if there is no call-to-action).

CTA (call-to-action)
- A CTA is ONLY a clear, explicit instruction telling the viewer to DO something: like, share, comment (including "comment the word X"), follow, save, subscribe, send this to someone, DM me, click the link, visit a page, etc.
- A CTA can be spoken in the video or written in the caption. If both have one, use the clearest.
- These are NOT CTAs: reflections, closing thoughts, statements about what the creator plans to do or share ("I will be sharing more…"), hopes, summaries, or inspirational wrap-ups. If the video does not explicitly tell the viewer to take an action, there is NO CTA.
- When there is no explicit instruction to the viewer, return null for the CTA, and leave the closing lines in the body.`,
        },
      ],
    });

    if (!response.parsed_output) return;

    await supabase
      .from("ct_reels")
      .update({
        hook_text: response.parsed_output.hookText,
        body_text: response.parsed_output.bodyText,
        cta_text: response.parsed_output.ctaText,
      })
      .eq("id", reelId);
  } catch {
    // Fail soft — a failed extraction shouldn't block the transcript itself
    // from being usable. Leaves hook/body/cta empty for this reel.
  }
}
