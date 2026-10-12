import { createClient } from "@/lib/supabase/server";

// Everything the AI should know: who you are (Settings), and the reference reel.
export async function loadLabContext(reelId: string) {
  const supabase = await createClient();
  const [{ data: reel }, { data: brand }, { data: foundation }] = await Promise.all([
    supabase.from("ct_reels").select("owner_username, views, comments_count, duration_seconds, hook_text, body_text, cta_text, transcript, caption, post_type").eq("id", reelId).single(),
    supabase.from("ct_brand_profile").select("headline, about, voice, known_for, story_beats").eq("id", "00000000-0000-0000-0000-000000000001").maybeSingle(),
    supabase.from("ct_brand_foundation").select("good_at, love_learning, people_need, overlap, voice, journey, for_against").eq("id", "00000000-0000-0000-0000-000000000001").maybeSingle(),
  ]);
  if (!reel) throw new Error("Couldn't find that reel.");
  let avgViews: number | null = null;
  if (reel.owner_username) {
    const { data: others } = await supabase.from("ct_reels").select("views").eq("owner_username", reel.owner_username).limit(60);
    if (others && others.length >= 2) avgViews = others.reduce((s, r) => s + ((r.views as number) ?? 0), 0) / others.length;
  }
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(Boolean).join("; ") : "");
  const me = [
    brand?.headline && `Headline: ${brand.headline}`,
    brand?.about && `About me: ${brand.about}`,
    list(brand?.voice) && `My voice: ${list(brand?.voice)}`,
    list(brand?.known_for) && `Known for: ${list(brand?.known_for)}`,
    list(brand?.story_beats) && `My story: ${list(brand?.story_beats)}`,
    foundation?.voice && `Voice notes: ${foundation.voice}`,
    foundation?.journey && `My journey: ${foundation.journey}`,
    foundation?.for_against && `What I'm for and against: ${foundation.for_against}`,
    foundation?.people_need && `What people need from me: ${foundation.people_need}`,
  ]
    .filter(Boolean)
    .join("\n");
  // The hook lives in the opening one or two sentences. Hand the AI those exact sentences, whole.
  const transcript = String(reel.transcript ?? reel.caption ?? "").trim();
  const words = transcript.split(/\s+/).filter(Boolean);
  const sentences = (transcript.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [transcript]).map((x) => x.trim()).filter(Boolean);
  const s1 = sentences[0] ?? words.slice(0, 30).join(" ");
  const s2 = sentences[1] ?? "";
  const ref = [
    `Creator: @${reel.owner_username ?? "unknown"}`,
    `Views: ${reel.views}${avgViews ? ` (their average is about ${Math.round(avgViews)})` : ""}. Comments: ${reel.comments_count}. Length: ${reel.duration_seconds ? Math.round(reel.duration_seconds as number) + " seconds" : "unknown"}.`,
    `THE REEL'S OPENING SENTENCES (the hook is in here, from the first word): 1) "${s1}"${s2 ? ` 2) "${s2}"` : ""}`,
    reel.cta_text && `Its call to action: ${reel.cta_text}`,
    `Full transcript:\n${transcript.slice(0, 4000)}`,
  ]
    .filter(Boolean)
    .join("\n");
  const seconds = (reel.duration_seconds as number | null) ?? null;
  return { me: me || "(nothing saved in Settings yet)", ref, seconds };
}
