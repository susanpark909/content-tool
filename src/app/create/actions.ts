"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { getScriptProcessSettings } from "@/lib/script-process";
import { ANGLES } from "./constants";

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
        reason: z.string().describe("One-line reason this fits — the first match's reason should read like a confident recommendation, not a neutral label"),
      }),
    )
    .min(2)
    .max(3)
    .describe("Ordered best fit first — matches[0] is the top recommendation"),
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

export async function recommendAngle(ideaId: string): Promise<PatternMatch[]> {
  const [idea, settings] = await Promise.all([
    getIdea(ideaId),
    getScriptProcessSettings(),
  ]);

  const list = ANGLES.map((a, i) => `${i}: ${a}`).join("\n");

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: { effort: "low", format: zodOutputFormat(MatchSchema) },
    messages: [
      {
        role: "user",
        content: `${settings.angleInstructions}

Idea:
"""
${idea.content}
"""

Available angles (choose ONLY from this list, never invent a new one):
${list}

Pick the 2-3 angles that best fit this idea, best fit first.`,
      },
    ],
  });

  if (!response.parsed_output) throw new Error("Could not parse angle recommendations");

  const seen = new Set<number>();
  const matches: PatternMatch[] = [];
  for (const m of response.parsed_output.matches) {
    const a = ANGLES[m.index];
    if (!a || seen.has(m.index)) continue;
    seen.add(m.index);
    matches.push({ id: a, name: a, reason: m.reason });
  }
  if (matches.length === 0) throw new Error("AI did not return any valid angle recommendations");
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

Pick the 2-3 frameworks that best fit this idea and angle, best fit first.`,
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
  const [{ data: framework, error: fwError }, settings] = await Promise.all([
    supabase.from("ct_frameworks").select("name").eq("id", frameworkId).single(),
    getScriptProcessSettings(),
  ]);

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

export async function generateDraftScript(params: {
  ideaId: string;
  angle: string;
  frameworkId: string;
  answers: { question: string; answer: string }[];
}): Promise<{ id: string; content: string }> {
  const supabase = await createClient();
  const [idea, { data: framework, error: fwError }, { data: brand }, settings] =
    await Promise.all([
      getIdea(params.ideaId),
      supabase.from("ct_frameworks").select("name, description").eq("id", params.frameworkId).single(),
      supabase
        .from("ct_brand_profile")
        .select(
          "voice_tone, phrases_to_use, phrases_to_avoid, audience, strong_opinion_wedge",
        )
        .single(),
      getScriptProcessSettings(),
    ]);

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
Chosen framework: ${framework?.name}${framework?.description ? ` — ${framework.description}` : ""}

Answers to follow-up questions:
"""
${answersBlock || "(none given)"}
"""

Brand Profile:
"""
${brandBlock}
"""

Write the full script draft now.`,
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

export async function recommendHooksForDraft(
  scriptId: string,
): Promise<PatternMatch[]> {
  const supabase = await createClient();
  const [{ data: script, error: scriptError }, { data: patterns, error: patternsError }, settings] =
    await Promise.all([
      supabase.from("ct_scripts").select("content, angle").eq("id", scriptId).single(),
      supabase.from("ct_hook_patterns").select("id, name").order("created_at"),
      getScriptProcessSettings(),
    ]);

  if (scriptError) throw new Error(scriptError.message);
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

Script draft:
"""
${script?.content}
"""

Angle: ${script?.angle}

Available hook structures (choose ONLY from this list, never invent a new one):
${list}

Pick the 2-3 hook structures that best fit this actual draft, best fit first.`,
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

const HookRewriteSchema = z.object({
  script: z.string().describe("The full script with only the opening/hook lines rewritten to use the chosen hook structure — the rest of the script's substance stays intact"),
});

export async function finalizeScriptHook(
  scriptId: string,
  hookPatternId: string,
): Promise<{ content: string }> {
  const supabase = await createClient();
  const [{ data: script, error: scriptError }, { data: hookPattern, error: hookError }, settings] =
    await Promise.all([
      supabase.from("ct_scripts").select("content").eq("id", scriptId).single(),
      supabase.from("ct_hook_patterns").select("name").eq("id", hookPatternId).single(),
      getScriptProcessSettings(),
    ]);

  if (scriptError) throw new Error(scriptError.message);
  if (hookError) throw new Error(hookError.message);

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 2048,
    output_config: { effort: "medium", format: zodOutputFormat(HookRewriteSchema) },
    messages: [
      {
        role: "user",
        content: `${settings.hookInstructions}

Current draft:
"""
${script?.content}
"""

Chosen hook structure: ${hookPattern?.name}

Rewrite only the opening/hook of this draft to use the chosen hook structure. Keep everything else — the body, the lesson, the CTA — intact. Return the complete script.`,
      },
    ],
  });

  if (!response.parsed_output) throw new Error("Could not parse finalized script");
  const content = response.parsed_output.script.trim();
  if (!content) throw new Error("AI did not return a script");

  const { error: saveError } = await supabase
    .from("ct_scripts")
    .update({
      hook_pattern_id: hookPatternId,
      content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scriptId);

  if (saveError) throw new Error(saveError.message);

  revalidatePath("/create");
  return { content };
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
