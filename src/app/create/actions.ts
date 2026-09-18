"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { getScriptProcessSettings } from "@/lib/script-process";

export type PatternMatch = {
  id: string;
  name: string;
  reason: string;
};

const MatchSchema = z.object({
  matches: z
    .array(
      z.object({
        index: z.number().int().describe("0-based index into the provided list"),
        reason: z.string().describe("One-line reason this fits the idea and angle"),
      }),
    )
    .min(2)
    .max(3),
});

async function getIdea(ideaId: string) {
  const supabase = await createClient();
  const { data: idea, error } = await supabase
    .from("ct_journal_entries")
    .select(
      "id, content, framework_id, flesh_out_answers, fleshed_out",
    )
    .eq("id", ideaId)
    .single();
  if (error) throw new Error(error.message);
  if (!idea) throw new Error("Idea not found");
  return idea;
}

export async function matchHookPatterns(
  ideaId: string,
  angle: string,
): Promise<PatternMatch[]> {
  const supabase = await createClient();
  const [idea, { data: patterns, error: patternsError }, settings] =
    await Promise.all([
      getIdea(ideaId),
      supabase.from("ct_hook_patterns").select("id, name").order("created_at"),
      getScriptProcessSettings(),
    ]);

  if (patternsError) throw new Error(patternsError.message);
  if (!patterns || patterns.length === 0) {
    throw new Error("No hook patterns in the library yet");
  }

  const list = patterns.map((p, i) => `${i}: ${p.name}`).join("\n");

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: { effort: "low", format: zodOutputFormat(MatchSchema) },
    messages: [
      {
        role: "user",
        content: `${settings.hookInstructions}

Idea:
"""
${idea.content}
"""

Chosen angle: ${angle}

Available hook structures (choose ONLY from this list, never invent a new one):
${list}

Pick the 2-3 hook structures that best fit this idea and angle. For each, give a one-line reason.`,
      },
    ],
  });

  if (!response.parsed_output) throw new Error("Could not parse hook matches");

  const seen = new Set<number>();
  const matches: PatternMatch[] = [];
  for (const m of response.parsed_output.matches) {
    const p = patterns[m.index];
    if (!p || seen.has(m.index)) continue;
    seen.add(m.index);
    matches.push({ id: p.id, name: p.name, reason: m.reason });
  }
  if (matches.length === 0) throw new Error("AI did not return any valid hook matches");
  return matches;
}

export async function matchFrameworksForScript(
  ideaId: string,
  angle: string,
): Promise<PatternMatch[]> {
  const supabase = await createClient();
  const [idea, { data: frameworks, error: fwError }, settings] =
    await Promise.all([
      getIdea(ideaId),
      supabase.from("ct_frameworks").select("id, name").order("created_at"),
      getScriptProcessSettings(),
    ]);

  if (fwError) throw new Error(fwError.message);
  if (!frameworks || frameworks.length === 0) {
    throw new Error("No frameworks in the library yet");
  }

  const list = frameworks.map((f, i) => `${i}: ${f.name}`).join("\n");

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: { effort: "low", format: zodOutputFormat(MatchSchema) },
    messages: [
      {
        role: "user",
        content: `${settings.frameworkInstructions}

Idea:
"""
${idea.content}
"""

Chosen angle: ${angle}

Available frameworks (choose ONLY from this list, never invent a new one):
${list}

Pick the 2-3 frameworks that best fit this idea and angle. For each, give a one-line reason.`,
      },
    ],
  });

  if (!response.parsed_output) throw new Error("Could not parse framework matches");

  const seen = new Set<number>();
  const matches: PatternMatch[] = [];
  for (const m of response.parsed_output.matches) {
    const f = frameworks[m.index];
    if (!f || seen.has(m.index)) continue;
    seen.add(m.index);
    matches.push({ id: f.id, name: f.name, reason: m.reason });
  }
  if (matches.length === 0) throw new Error("AI did not return any valid framework matches");
  return matches;
}

const QuestionsSchema = z.object({
  questions: z
    .array(
      z
        .string()
        .max(140)
        .describe("One short, casual, single-part question — no examples or 'e.g.' asides"),
    )
    .min(2)
    .max(4),
});

export async function getScriptQuestions(
  ideaId: string,
  angle: string,
  hookPatternId: string,
  frameworkId: string,
): Promise<{ reused: boolean; questions: string[]; answers: string[] }> {
  const idea = await getIdea(ideaId);

  // If this idea was already fleshed out for this exact framework, reuse those
  // answers as the meat instead of asking again.
  if (
    idea.fleshed_out &&
    idea.framework_id === frameworkId &&
    Array.isArray(idea.flesh_out_answers) &&
    idea.flesh_out_answers.length > 0
  ) {
    const existing = idea.flesh_out_answers as { question: string; answer: string }[];
    return {
      reused: true,
      questions: existing.map((a) => a.question),
      answers: existing.map((a) => a.answer),
    };
  }

  const supabase = await createClient();
  const [{ data: hookPattern, error: hookError }, { data: framework, error: fwError }, settings] =
    await Promise.all([
      supabase.from("ct_hook_patterns").select("name").eq("id", hookPatternId).single(),
      supabase.from("ct_frameworks").select("name").eq("id", frameworkId).single(),
      getScriptProcessSettings(),
    ]);

  if (hookError) throw new Error(hookError.message);
  if (fwError) throw new Error(fwError.message);

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: { effort: "low", format: zodOutputFormat(QuestionsSchema) },
    messages: [
      {
        role: "user",
        content: `${settings.questionsInstructions}

Idea:
"""
${idea.content}
"""

Chosen angle: ${angle}
Chosen hook structure: ${hookPattern?.name}
Chosen framework: ${framework?.name}

Generate 2-4 follow-up questions.`,
      },
    ],
  });

  if (!response.parsed_output) throw new Error("Could not parse follow-up questions");

  const questions = response.parsed_output.questions;
  return { reused: false, questions, answers: questions.map(() => "") };
}

const ScriptSchema = z.object({
  script: z.string().describe("The full script text, ready to record — no preamble, headers, or explanation, just the script itself"),
});

export async function generateScript(params: {
  ideaId: string;
  angle: string;
  hookPatternId: string;
  frameworkId: string;
  answers: { question: string; answer: string }[];
}): Promise<{ id: string; content: string }> {
  const supabase = await createClient();
  const [idea, { data: hookPattern, error: hookError }, { data: framework, error: fwError }, { data: brand }, settings] =
    await Promise.all([
      getIdea(params.ideaId),
      supabase.from("ct_hook_patterns").select("name").eq("id", params.hookPatternId).single(),
      supabase.from("ct_frameworks").select("name, description").eq("id", params.frameworkId).single(),
      supabase
        .from("ct_brand_profile")
        .select(
          "voice_tone, phrases_to_use, phrases_to_avoid, audience, strong_opinion_wedge",
        )
        .single(),
      getScriptProcessSettings(),
    ]);

  if (hookError) throw new Error(hookError.message);
  if (fwError) throw new Error(fwError.message);

  const answersBlock = params.answers
    .filter((a) => a.answer.trim())
    .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
    .join("\n\n");

  const brandBlock = brand
    ? `Voice/tone: ${brand.voice_tone || "(not set)"}
Phrases to use: ${brand.phrases_to_use || "(not set)"}
Phrases to avoid: ${brand.phrases_to_avoid || "(not set)"}
Audience: ${brand.audience || "(not set)"}
Strong opinion/wedge: ${brand.strong_opinion_wedge || "(not set)"}`
    : "(no Brand Profile set yet)";

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 2048,
    output_config: { effort: "medium", format: zodOutputFormat(ScriptSchema) },
    messages: [
      {
        role: "user",
        content: `${settings.scriptInstructions}

Idea:
"""
${idea.content}
"""

Chosen angle: ${params.angle}
Chosen hook structure: ${hookPattern?.name}
Chosen framework: ${framework?.name}${framework?.description ? ` — ${framework.description}` : ""}

Answers to follow-up questions:
"""
${answersBlock || "(none given)"}
"""

Brand Profile:
"""
${brandBlock}
"""

Write the full script now.`,
      },
    ],
  });

  if (!response.parsed_output) throw new Error("Could not parse generated script");
  const content = response.parsed_output.script.trim();
  if (!content) throw new Error("AI did not return a script");

  const { data: saved, error: saveError } = await supabase
    .from("ct_scripts")
    .insert({
      idea_id: params.ideaId,
      angle: params.angle,
      hook_pattern_id: params.hookPatternId,
      framework_id: params.frameworkId,
      questions: params.answers,
      content,
    })
    .select("id, content")
    .single();

  if (saveError) throw new Error(saveError.message);

  revalidatePath("/create");
  return saved;
}

export async function updateScriptContent(scriptId: string, content: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ct_scripts")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", scriptId);

  if (error) throw new Error(error.message);
  revalidatePath("/create");
}
