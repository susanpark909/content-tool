"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/anthropic";
import type { ContentType } from "@/lib/content-types";

function refresh() {
  revalidatePath("/reels");
  revalidatePath("/library");
  revalidatePath("/scripts", "layout");
  revalidatePath("/creators", "layout");
}

export type TypeWithCounts = ContentType & { reelCount: number; ideaCount: number };

const mapType = (t: { id: unknown; name: unknown; color: unknown; position: unknown }): ContentType => ({
  id: t.id as string,
  name: t.name as string,
  color: t.color as string,
  position: t.position as number,
});

export async function getTypeCounts(): Promise<TypeWithCounts[]> {
  const supabase = await createClient();
  const [{ data: types }, { data: reelLinks }, { data: ideaLinks }] = await Promise.all([
    supabase.from("ct_content_types").select("id, name, color, position").order("position").order("created_at"),
    supabase.from("ct_reel_types").select("type_id"),
    supabase.from("ct_idea_types").select("type_id"),
  ]);
  const count = (rows: { type_id: unknown }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.type_id as string, (m.get(r.type_id as string) ?? 0) + 1);
    return m;
  };
  const rc = count(reelLinks);
  const ic = count(ideaLinks);
  return (types ?? []).map((t) => ({ ...mapType(t), reelCount: rc.get(t.id as string) ?? 0, ideaCount: ic.get(t.id as string) ?? 0 }));
}

export async function createContentType(name: string, color: string): Promise<ContentType> {
  const clean = name.trim();
  if (!clean) throw new Error("Give the tag a name");
  const supabase = await createClient();
  const { data: last } = await supabase.from("ct_content_types").select("position").order("position", { ascending: false }).limit(1);
  const position = ((last?.[0]?.position as number | undefined) ?? -1) + 1;
  const { data, error } = await supabase.from("ct_content_types").insert({ name: clean, color, position }).select("id, name, color, position").single();
  if (error) throw new Error(error.code === "23505" ? `You already have a tag called "${clean}"` : error.message);
  refresh();
  return mapType(data);
}

export async function updateContentType(id: string, patch: { name?: string; color?: string }) {
  const supabase = await createClient();
  const update: Record<string, string> = {};
  if (patch.name != null) {
    if (!patch.name.trim()) throw new Error("Give the tag a name");
    update.name = patch.name.trim();
  }
  if (patch.color != null) update.color = patch.color;
  const { error } = await supabase.from("ct_content_types").update(update).eq("id", id);
  if (error) throw new Error(error.code === "23505" ? "You already have a tag with that name" : error.message);
  refresh();
}

export async function reorderContentTypes(ids: string[]) {
  const supabase = await createClient();
  await Promise.all(ids.map((id, i) => supabase.from("ct_content_types").update({ position: i }).eq("id", id)));
  refresh();
}

// Deleting a tag also takes it off every reel and idea that had it. The reels and ideas stay.
export async function deleteContentType(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("ct_content_types").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function setReelTypes(reelId: string, typeIds: string[]) {
  const supabase = await createClient();
  await supabase.from("ct_reel_types").delete().eq("reel_id", reelId);
  if (typeIds.length > 0) {
    const { error } = await supabase.from("ct_reel_types").insert(typeIds.map((type_id) => ({ reel_id: reelId, type_id })));
    if (error) throw new Error(error.message);
  }
  refresh();
}

export async function addTypesToReels(reelIds: string[], typeIds: string[]) {
  if (reelIds.length === 0 || typeIds.length === 0) return;
  const supabase = await createClient();
  const rows = reelIds.flatMap((reel_id) => typeIds.map((type_id) => ({ reel_id, type_id })));
  const { error } = await supabase.from("ct_reel_types").upsert(rows, { onConflict: "reel_id,type_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  refresh();
}

export async function removeTypesFromReels(reelIds: string[], typeIds: string[]) {
  if (reelIds.length === 0 || typeIds.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("ct_reel_types").delete().in("reel_id", reelIds).in("type_id", typeIds);
  if (error) throw new Error(error.message);
  refresh();
}

export async function setIdeaTypes(ideaId: string, typeIds: string[]) {
  const supabase = await createClient();
  await supabase.from("ct_idea_types").delete().eq("idea_id", ideaId);
  if (typeIds.length > 0) {
    const { error } = await supabase.from("ct_idea_types").insert(typeIds.map((type_id) => ({ idea_id: ideaId, type_id })));
    if (error) throw new Error(error.message);
  }
  refresh();
}

const SuggestionSchema = z.object({
  types: z.array(z.string()).describe("The 1 to 3 content types from the list that best describe this reel, spelled exactly as in the list. Empty if none clearly fits."),
});

// Reads each reel's hook, caption and transcript and proposes content types from YOUR list.
// Nothing is saved: the person reviews and accepts the suggestions.
export async function suggestTypes(reelIds: string[]): Promise<Record<string, string[]>> {
  const ids = reelIds.slice(0, 12);
  const supabase = await createClient();
  const [{ data: types }, { data: reels }] = await Promise.all([
    supabase.from("ct_content_types").select("id, name").order("position"),
    supabase.from("ct_reels").select("id, caption, hook_text, transcript").in("id", ids),
  ]);
  if (!types || types.length === 0 || !reels) return {};
  const byName = new Map(types.map((t) => [(t.name as string).toLowerCase(), t.id as string]));
  const list = types.map((t) => `- ${t.name}`).join("\n");
  const client = getAnthropicClient();
  const out: Record<string, string[]> = {};

  await Promise.all(
    reels.map(async (r) => {
      const transcript = ((r.transcript as string | null) ?? "").slice(0, 2500);
      const caption = ((r.caption as string | null) ?? "").slice(0, 600);
      if (!transcript.trim() && !caption.trim()) return;
      try {
        const response = await client.messages.parse({
          model: "claude-haiku-5-5",
          max_tokens: 300,
          output_config: { format: zodOutputFormat(SuggestionSchema) },
          messages: [
            {
              role: "user",
              content: `Tag this short-form video with the kind of content it is: its style or format, not its topic.

Choose from this list only (1 to 3, spelled exactly as written). Pick a type only if it clearly fits. If none fits, return an empty list.
${list}

Hook: ${r.hook_text ?? "(none)"}

Caption:
"""
${caption || "(none)"}
"""

Transcript:
"""
${transcript || "(not transcribed)"}
"""`,
            },
          ],
        });
        const names = response.parsed_output?.types ?? [];
        const found = names.map((n) => byName.get(n.trim().toLowerCase())).filter((x): x is string => Boolean(x));
        out[r.id as string] = [...new Set(found)].slice(0, 3);
      } catch {
        // one reel failing shouldn't stop the others
      }
    }),
  );
  return out;
}
