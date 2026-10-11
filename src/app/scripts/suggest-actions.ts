"use server";

import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";

// "Suggest For Me": describe your idea, get the five saved reels closest to it.
// 1) every analyzed reel has a one-line skim note (topic, tone, angle), written once from its transcript;
// 2) a small model scans all the notes and picks about 25 finalists;
// 3) a stronger model reads those finalists' full transcripts and chooses the best five, with a reason each.

const SKIM_MODEL = "claude-haiku-5-5";
const PICK_MODEL = "claude-sonnet-5-5";
const MAX_POOL = 500;
const FINALISTS = 25;

type Usage = { input_tokens?: number; output_tokens?: number } | undefined;

// Every AI call is logged, so plan limits and credits can be added on top later.
async function logUsage(kind: string, usage: Usage) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("ct_ai_usage").insert({ kind, input_tokens: usage?.input_tokens ?? 0, output_tokens: usage?.output_tokens ?? 0 });
    if (error) console.error("usage log failed", error.message);
  } catch (e) {
    console.error("usage log failed", e);
  }
}

const NoteSchema = z.object({
  topic: z.string().describe("What it is about, in at most 12 words."),
  tone: z.string().describe("The tone and feeling in 2 to 4 words, e.g. 'funny, self-deprecating' or 'inspirational, warm'."),
  angle: z.string().describe("How it is told, in at most 12 words, e.g. 'personal story that ends in a lesson'."),
});

export async function countMissingNotes(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("ct_reels")
    .select("id", { count: "exact", head: true })
    .eq("scan_only", false)
    .eq("transcription_status", "ready")
    .not("transcript", "is", null)
    .is("skim_note", null);
  return count ?? 0;
}

// Writes skim notes for a batch of reels that don't have one yet. Call again until nothing remains.
export async function prepareNotes(batch = 15): Promise<{ remaining: number }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ct_reels")
    .select("id, caption, transcript")
    .eq("scan_only", false)
    .eq("transcription_status", "ready")
    .not("transcript", "is", null)
    .is("skim_note", null)
    .limit(batch);
  const client = getAnthropicClient();
  await Promise.all(
    (data ?? []).map(async (r) => {
      try {
        const res = await client.messages.parse({
          model: SKIM_MODEL,
          max_tokens: 300,
          output_config: { format: zodOutputFormat(NoteSchema) },
          messages: [
            {
              role: "user",
              content: `Write a short skim note for this Instagram post so it can be found later by topic and feeling.\n\nCaption:\n"""\n${((r.caption as string | null) ?? "").slice(0, 500)}\n"""\n\nTranscript or slide text:\n"""\n${((r.transcript as string) ?? "").slice(0, 3000)}\n"""`,
            },
          ],
        });
        await logUsage("skim", res.usage as Usage);
        const n = res.parsed_output;
        if (n) await supabase.from("ct_reels").update({ skim_note: `${n.topic} | ${n.tone} | ${n.angle}` }).eq("id", r.id);
      } catch {
        // leave it empty; it is retried on the next call
      }
    }),
  );
  return { remaining: await countMissingNotes() };
}

export type SuggestedReel = {
  id: string;
  reason: string;
  text: string;
  thumbnailUrl: string | null;
  owner: string | null;
  postType: string;
  views: number;
};

const ShortlistSchema = z.object({ ids: z.array(z.string()).describe("Up to 25 ids of the reels that best fit the brief, best first.") });
const PicksSchema = z.object({
  picks: z
    .array(z.object({ id: z.string(), reason: z.string().describe("One sentence (at most 25 words) on why this reel fits the brief and what to borrow from it.") }))
    .describe("The five best reels for the brief, best first."),
});

export async function suggestReels(input: { brief: string; format: "all" | "reel" | "carousel" }): Promise<SuggestedReel[]> {
  const brief = input.brief.trim().slice(0, 1500);
  if (!brief) throw new Error("Tell me a little about your idea first.");
  const supabase = await createClient();
  let q = supabase
    .from("ct_reels")
    .select("id, hook_text, caption, skim_note, post_type, owner_username, thumbnail_url, views")
    .eq("scan_only", false)
    .eq("transcription_status", "ready")
    .not("transcript", "is", null)
    .order("created_at", { ascending: false })
    .limit(MAX_POOL);
  if (input.format !== "all") q = q.eq("post_type", input.format);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const pool = data ?? [];
  if (pool.length === 0) throw new Error("No analyzed " + (input.format === "carousel" ? "carousels" : input.format === "reel" ? "reels" : "posts") + " to look through yet.");

  const client = getAnthropicClient();
  const line = (r: (typeof pool)[number]) => {
    const hook = ((r.hook_text as string | null) || (r.caption as string | null) || "").split("\n")[0].trim().slice(0, 140);
    return `${r.id} | ${hook} | ${(r.skim_note as string | null) ?? "(no note)"}`;
  };

  // Step 1: skim every note, keep the finalists.
  let finalists = pool;
  if (pool.length > 6) {
    const short = await client.messages.parse({
      model: SKIM_MODEL,
      max_tokens: 600,
      output_config: { format: zodOutputFormat(ShortlistSchema) },
      messages: [
        {
          role: "user",
          content: `I am writing a new post and want to study similar saved ones. Here is my idea:\n"""\n${brief}\n"""\n\nBelow are my saved posts, one per line as: id | hook | topic | tone | angle. Pick the ${FINALISTS} that best match my idea in topic, tone and the way it is told. Only use ids from the list.\n\n${pool.map(line).join("\n")}`,
        },
      ],
    });
    await logUsage("suggest-shortlist", short.usage as Usage);
    const ids = new Set(short.parsed_output?.ids ?? []);
    const picked = pool.filter((r) => ids.has(r.id as string));
    finalists = picked.length > 0 ? picked.slice(0, FINALISTS) : pool.slice(0, FINALISTS);
  }

  // Step 2: read the finalists' full transcripts and choose five.
  const { data: full } = await supabase.from("ct_reels").select("id, transcript").in("id", finalists.map((r) => r.id as string));
  const textById = new Map((full ?? []).map((r) => [r.id as string, ((r.transcript as string | null) ?? "").slice(0, 2200)]));
  const final = await client.messages.parse({
    model: PICK_MODEL,
    max_tokens: 1200,
    output_config: { format: zodOutputFormat(PicksSchema) },
    messages: [
      {
        role: "user",
        content: `I am writing a new post. Here is my idea:\n"""\n${brief}\n"""\n\nRead these saved posts (full transcripts or slide text) and choose the 5 that are the best models for my idea: closest in topic, tone and how it is told. Only use ids from the list.\n\n${finalists
          .map((r) => `### ${r.id}\n${textById.get(r.id as string) || "(no text)"}`)
          .join("\n\n")}`,
      },
    ],
  });
  await logUsage("suggest-pick", final.usage as Usage);

  const byId = new Map(finalists.map((r) => [r.id as string, r]));
  const out: SuggestedReel[] = [];
  for (const p of final.parsed_output?.picks ?? []) {
    const r = byId.get(p.id);
    if (!r || out.some((o) => o.id === p.id)) continue;
    out.push({
      id: r.id as string,
      reason: p.reason,
      text: ((r.hook_text as string | null) || (r.caption as string | null) || "").split("\n")[0].trim(),
      thumbnailUrl: r.thumbnail_url as string | null,
      owner: r.owner_username as string | null,
      postType: (r.post_type as string) ?? "reel",
      views: (r.views as number) ?? 0,
    });
    if (out.length === 5) break;
  }
  return out;
}
