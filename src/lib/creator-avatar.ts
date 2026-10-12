import { fetchPublicProfilePic } from "@/lib/instagram-public";
import { saveAvatarPermanently } from "@/lib/reel-thumbnail";
import type { createClient } from "@/lib/supabase/server";

// A creator's picture, as cheaply as possible: reuse one we already saved; otherwise read it free from their
// public profile page and save a permanent copy. Null when neither works (the app shows their initials).
export async function getCreatorAvatar(supabase: Awaited<ReturnType<typeof createClient>>, username: string | null): Promise<string | null> {
  if (!username) return null;
  const { data } = await supabase.from("ct_reels").select("owner_avatar_url").eq("owner_username", username).not("owner_avatar_url", "is", null).limit(1);
  const have = data?.[0]?.owner_avatar_url as string | undefined;
  if (have) return have;
  const pic = await fetchPublicProfilePic(username);
  return pic ? await saveAvatarPermanently(pic, username) : null;
}
