import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";

export type ScriptCandidate = {
  id: string;
  hookText: string | null;
  bodyText: string | null;
  ctaText: string | null;
  caption: string | null;
};

const SuggestionSchema = z.object({
  matches: z
    .array(
      z.object({
        index: z.number().int(),
        reason: z
          .string()
          .describe("One short line on why this script fits the idea"),
      }),
    )
    .describe(
      "Up to 5 best-fitting scripts for this idea, ordered best first. Empty array if nothing fits well.",
    ),
});

// Ranks saved scripts by relevance to an idea's content, for the "pull in a
// script for inspiration" panel on the script-writing page. Just relevance
// ranking - no pattern/framework classification.
export async function suggestScriptsForIdea(
  ideaContent: string,
  candidates: ScriptCandidate[],
): Promise<{ id: string; reason: string }[]> {
  if (candidates.length === 0) return [];

  const list = candidates
    .map((c, i) => {
      const parts = [c.hookText, c.bodyText, c.ctaText].filter(Boolean).join(" ");
      return `${i}: ${parts.slice(0, 600)}`;
    })
    .join("\n\n");

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: {
      effort: "low",
      format: zodOutputFormat(SuggestionSchema),
    },
    messages: [
      {
        role: "user",
        content: `A content creator is about to write a script for this idea:

"""
${ideaContent}
"""

Here are their saved scripts from past reels, each numbered:

${list}

Pick up to 5 that would be genuinely useful references for writing this idea's script - similar topic, similar angle, or a hook/structure worth borrowing from. Order best first. Return an empty list if none are a good fit.`,
      },
    ],
  });

  if (!response.parsed_output) return [];

  return response.parsed_output.matches
    .filter((m) => candidates[m.index])
    .map((m) => ({ id: candidates[m.index].id, reason: m.reason }));
}
