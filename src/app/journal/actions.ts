"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";

export type JournalAttachmentInput = {
  url: string;
  type: string;
  name: string;
};

export async function createJournalEntry(
  content: string,
  attachments: JournalAttachmentInput[] = [],
  sourceReelId: string | null = null,
) {
  const trimmed = content.trim();
  if (!trimmed && attachments.length === 0) return;

  const supabase = await createClient();
  const { data: entry, error } = await supabase
    .from("ct_journal_entries")
    .insert({ content: trimmed, source_reel_id: sourceReelId })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (attachments.length > 0) {
    const { error: attachError } = await supabase.from("ct_journal_attachments").insert(
      attachments.map((a) => ({
        entry_id: entry.id,
        file_url: a.url,
        file_type: a.type,
        file_name: a.name,
      })),
    );
    if (attachError) throw new Error(attachError.message);
  }

  revalidatePath("/journal");
  if (sourceReelId) revalidatePath(`/research/reel/${sourceReelId}`);
}

export async function scheduleIdea(entryId: string, date: string | null) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ scheduled_date: date })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
  revalidatePath("/plan");
  revalidatePath("/create");
}

export async function setIdeaPosted(entryId: string, posted: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ posted, posted_at: posted ? new Date().toISOString() : null })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
  revalidatePath("/plan");
}

export async function setReadyToRecord(entryId: string, readyToRecord: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({
      ready_to_record: readyToRecord,
      ready_to_record_at: readyToRecord ? new Date().toISOString() : null,
    })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
  revalidatePath("/plan");
}

export async function setRecorded(entryId: string, recorded: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({
      recorded,
      recorded_at: recorded ? new Date().toISOString() : null,
    })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
  revalidatePath("/plan");
}

export async function updateJournalContent(entryId: string, content: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ content: content.trim() })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
}

export async function updateFleshOutAnswers(
  entryId: string,
  answers: { question: string; answer: string }[],
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({ flesh_out_answers: answers })
    .eq("id", entryId);

  if (error) throw new Error(error.message);
  revalidatePath("/journal");
}

export type FrameworkMatch = {
  id: string;
  name: string;
  reason: string;
};

const FrameworkMatchSchema = z.object({
  matches: z
    .array(
      z.object({
        frameworkIndex: z
          .number()
          .int()
          .describe("0-based index into the provided framework list"),
        reason: z
          .string()
          .describe("One-line reason this framework fits the idea"),
      }),
    )
    .min(2)
    .max(3),
});

export async function matchFrameworks(
  ideaId: string,
): Promise<FrameworkMatch[]> {
  const supabase = await createClient();

  const [{ data: idea, error: ideaError }, { data: frameworks, error: fwError }] =
    await Promise.all([
      supabase
        .from("ct_journal_entries")
        .select("id, content")
        .eq("id", ideaId)
        .single(),
      supabase.from("ct_frameworks").select("id, name").order("created_at"),
    ]);

  if (ideaError) throw new Error(ideaError.message);
  if (fwError) throw new Error(fwError.message);
  if (!idea) throw new Error("Idea not found");
  if (!frameworks || frameworks.length === 0) {
    throw new Error("No frameworks in the library yet");
  }

  const frameworkList = frameworks
    .map((f, i) => `${i}: ${f.name}`)
    .join("\n");

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: {
      effort: "low",
      format: zodOutputFormat(FrameworkMatchSchema),
    },
    messages: [
      {
        role: "user",
        content: `You are helping pick the best-fit content frameworks for a short-form content idea.

Idea:
"""
${idea.content}
"""

Available frameworks (choose ONLY from this list, never invent a new one):
${frameworkList}

Pick the 2-3 frameworks that best fit this idea. For each, give a one-line reason why it fits this specific idea.`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Could not parse framework matches");
  }

  const seen = new Set<number>();
  const matches: FrameworkMatch[] = [];
  for (const m of response.parsed_output.matches) {
    const fw = frameworks[m.frameworkIndex];
    if (!fw || seen.has(m.frameworkIndex)) continue;
    seen.add(m.frameworkIndex);
    matches.push({ id: fw.id, name: fw.name, reason: m.reason });
  }

  if (matches.length === 0) {
    throw new Error("AI did not return any valid framework matches");
  }

  return matches;
}

const FollowUpQuestionsSchema = z.object({
  questions: z
    .array(
      z
        .string()
        .max(140)
        .describe(
          "One short, casual, single-part question — no examples or 'e.g.' asides",
        ),
    )
    .min(2)
    .max(4),
});

export async function getFollowUpQuestions(
  ideaId: string,
  frameworkId: string,
): Promise<string[]> {
  const supabase = await createClient();

  const [{ data: idea, error: ideaError }, { data: framework, error: fwError }] =
    await Promise.all([
      supabase
        .from("ct_journal_entries")
        .select("id, content")
        .eq("id", ideaId)
        .single(),
      supabase
        .from("ct_frameworks")
        .select("id, name")
        .eq("id", frameworkId)
        .single(),
    ]);

  if (ideaError) throw new Error(ideaError.message);
  if (fwError) throw new Error(fwError.message);
  if (!idea) throw new Error("Idea not found");
  if (!framework) throw new Error("Framework not found");

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: {
      effort: "low",
      format: zodOutputFormat(FollowUpQuestionsSchema),
    },
    messages: [
      {
        role: "user",
        content: `Idea:
"""
${idea.content}
"""

Chosen framework: ${framework.name}

Generate 2-4 follow-up questions that would help flesh out this specific idea using this exact framework's structure.

Each question must be:
- One short sentence, asking exactly one thing — no bundled sub-questions, no "e.g." or parenthetical examples.
- Casual and conversational, like a friend asking, not a form or survey.
- Concrete and specific to this idea, not generic content-writing advice.`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error("Could not parse follow-up questions");
  }

  return response.parsed_output.questions;
}

export async function saveFleshOut(
  ideaId: string,
  frameworkId: string,
  answers: { question: string; answer: string }[],
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_journal_entries")
    .update({
      framework_id: frameworkId,
      flesh_out_answers: answers,
      fleshed_out: true,
    })
    .eq("id", ideaId);

  if (error) throw new Error(error.message);

  revalidatePath("/journal");
}
