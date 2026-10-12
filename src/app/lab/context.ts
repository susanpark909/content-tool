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
  // The hook is the very first thing said: the first few seconds. Give the AI those exact opening words so it never starts mid-way.
  const transcript = String(reel.transcript ?? reel.caption ?? "").trim();
  const words = transcript.split(/\s+/).filter(Boolean);
  // the opening: roughly the first five seconds of speech, from the very first word
  const opening = words.slice(0, 14).join(" ");
  const firstSentence = (transcript.match(/^[\s\S]*?[.!?](?=\s|$)/)?.[0] ?? words.slice(0, 30).join(" ")).trim();
  const ref = [
    `Creator: @${reel.owner_username ?? "unknown"}`,
    `Views: ${reel.views}${avgViews ? ` (their average is about ${Math.round(avgViews)})` : ""}. Comments: ${reel.comments_count}. Length: ${reel.duration_seconds ? Math.round(reel.duration_seconds as number) + " seconds" : "unknown"}.`,
    `THE HOOK STARTS AT THE VERY FIRST WORD. Its opening (about the first 5 seconds): "${opening}"\nIts first full sentence, for context: "${firstSentence}"`,
    reel.cta_text && `Its call to action: ${reel.cta_text}`,
    `Full transcript:\n${transcript.slice(0, 4000)}`,
  ]
    .filter(Boolean)
    .join("\n");
  const seconds = (reel.duration_seconds as number | null) ?? null;
  return { me: me || "(nothing saved in Settings yet)", ref, seconds };
}
