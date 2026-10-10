import { fetchAll } from "@/lib/fetch-all";
import type { createClient } from "@/lib/supabase/server";
import type { ContentType } from "@/lib/content-types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function loadTypes(supabase: Supabase): Promise<ContentType[]> {
  const { data } = await supabase.from("ct_content_types").select("id, name, color, position").order("position").order("created_at");
  return (data ?? []).map((t) => ({ id: t.id as string, name: t.name as string, color: t.color as string, position: t.position as number }));
}

// reel id -> the ids of its content types
export async function loadReelTypeMap(supabase: Supabase): Promise<Map<string, string[]>> {
  const { data } = await fetchAll((from, to) => supabase.from("ct_reel_types").select("reel_id, type_id").order("reel_id").order("type_id").range(from, to));
  const map = new Map<string, string[]>();
  for (const r of data ?? []) {
    const k = r.reel_id as string;
    const list = map.get(k) ?? [];
    list.push(r.type_id as string);
    map.set(k, list);
  }
  return map;
}
