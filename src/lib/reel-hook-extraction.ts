import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";

const ExtractionSchema = z.object({
  hookText: z
    .string()
    .describe("The exact opening hook line(s) from the transcript, verbatim"),
  bodyText: z
    .string()
    .describe(
      "The main content of the video after the hook and before any CTA — verbatim or lightly condensed if the transcript is long",
    ),
  ctaText: z
    .string()
    .nullable()
    .describe("The call-to-action used in the video or caption, if any, otherwise null"),
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

Extract the opening hook verbatim, the main body content, and any call-to-action. Do not classify, categorize, or explain anything — just extract the three parts as plain text.`,
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
