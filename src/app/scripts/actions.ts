"use server";

import { createClient } from "@/lib/supabase/server";

export type AttachableReel = {
  id: string;
  text: string;
  thumbnailUrl: string | null;
  owner: string | null;
  views: number;
  comments: number;
  shares: number | null;
  reposts: number | null;
  saves: number | null;
  goals: string[];
  analyzedAt: string;
};

// Reels you can attach to an idea as the one you're studying while you write.
export async function listAttachableReels(): Promise<AttachableReel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ct_reels")
    .select("id, caption, hook_text, thumbnail_url, owner_username, views, comments_count, shares_count, reposts_count, saves_count, goals, created_at")
    .order("created_at", { ascending: false })
    .limit(600);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    text: ((r.hook_text as string | null) || (r.caption as string | null) || "").split("\n")[0].trim(),
    thumbnailUrl: r.thumbnail_url as string | null,
    owner: r.owner_username as string | null,
    views: (r.views as number) ?? 0,
    comments: (r.comments_count as number) ?? 0,
    shares: r.shares_count as number | null,
    reposts: r.reposts_count as number | null,
    saves: r.saves_count as number | null,
    goals: ((r.goals as string[] | null) ?? []) as string[],
    analyzedAt: r.created_at as string,
  }));
}
