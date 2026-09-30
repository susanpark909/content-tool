"use server";

import { createClient } from "@/lib/supabase/server";
import { suggestScriptsForIdea } from "@/lib/script-suggestions";

export type ScriptInspirationRow = {
  id: string;
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  hookText: string | null;
  bodyText: string | null;
  ctaText: string | null;
  views: number | null;
  likes: number | null;
  commentsCount: number | null;
  sharesCount: number | null;
  reason: string | null;
};

export async function getScriptInspiration(
  ideaContent: string,
): Promise<{ suggested: ScriptInspirationRow[]; all: ScriptInspirationRow[] }> {
  const supabase = await createClient();

  const { data: reels, error } = await supabase
    .from("ct_reels")
    .select(
      "id, owner_username, owner_avatar_url, hook_text, body_text, cta_text, caption, views, likes, comments_count, shares_count",
    )
    .not("hook_text", "is", null)
    .order("views", { ascending: false });

  if (error) throw new Error(error.message);

  const rows: ScriptInspirationRow[] = (reels ?? []).map((r) => ({
    id: r.id,
    ownerUsername: r.owner_username,
    ownerAvatarUrl: r.owner_avatar_url,
    hookText: r.hook_text,
    bodyText: r.body_text,
    ctaText: r.cta_text,
    views: r.views,
    likes: r.likes,
    commentsCount: r.comments_count,
    sharesCount: r.shares_count,
    reason: null,
  }));

  let suggested: ScriptInspirationRow[] = [];
  if (ideaContent.trim() && rows.length > 0) {
    try {
      const matches = await suggestScriptsForIdea(
        ideaContent,
        (reels ?? []).map((r) => ({
          id: r.id,
          hookText: r.hook_text,
          bodyText: r.body_text,
          ctaText: r.cta_text,
          caption: r.caption,
        })),
      );
      const byId = new Map(rows.map((r) => [r.id, r]));
      suggested = matches.flatMap((m) => {
        const row = byId.get(m.id);
        return row ? [{ ...row, reason: m.reason }] : [];
      });
    } catch {
      suggested = [];
    }
  }

  return { suggested, all: rows };
}
