import type { TranscriptionSource } from "@/lib/transcription";

// Direct AssemblyAI transcription. Instagram's own video links expire within hours, so a link is never saved:
// when a reel is analyzed we ask the scraper for a fresh one and hand it straight to AssemblyAI.
// Anything missing or failing returns null so the caller can fall back to the older transcription tool.
const POST_ACTOR = "data-slayer~instagram-post-details";
const REELS_ACTOR = "scrapesage~instagram-reels-scraper";
const API = "https://api.assemblyai.com/v2/transcript";
export const AAI_PREFIX = "aai:";

const key = () => process.env.ASSEMBLYAI_API_KEY || null;
export const assemblyEnabled = () => !!key() && !!process.env.APIFY_API_TOKEN;

// The scraper account runs at most 5 lookups at once, so a batch is let through 4 at a time instead of all at once.
const MAX_AT_ONCE = 4;
let running = 0;
const waiting: (() => void)[] = [];
async function oneAtATime<T>(job: () => Promise<T>): Promise<T> {
  if (running >= MAX_AT_ONCE) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await job();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

async function runActor(actor: string, input: unknown): Promise<Record<string, unknown> | null> {
  return oneAtATime(() => runActorNow(actor, input));
}

async function runActorNow(actor: string, input: unknown): Promise<Record<string, unknown> | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}&timeout=40`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      // never let one lookup eat the whole request: past this, the next source (or the older tool) takes over
      signal: AbortSignal.timeout(22_000),
    });
    if (!res.ok) {
      console.error("[assemblyai] scraper", actor, "returned", res.status);
      return null;
    }
    return ((await res.json()) as Record<string, unknown>[])?.[0] ?? null;
  } catch (e) {
    console.error("[assemblyai] scraper", actor, "failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// The scraper used for full pulls first (it found the file for every reel tried), then the cheaper reels scraper.
async function freshVideo(url: string): Promise<{ videoUrl: string | null; hasAudio: boolean | null } | null> {
  const a = await runActor(POST_ACTOR, { postUrls: [url] });
  if (a && typeof a.video_url === "string" && a.video_url) return { videoUrl: a.video_url, hasAudio: typeof a.has_audio === "boolean" ? a.has_audio : null };
  const b = await runActor(REELS_ACTOR, { reelUrls: [url], includeReelDetails: false, maxResults: 1 });
  if (b && typeof b.videoUrl === "string" && b.videoUrl) return { videoUrl: b.videoUrl, hasAudio: typeof b.hasAudio === "boolean" ? b.hasAudio : null };
  return null;
}

export async function startAssembly(url: string): Promise<TranscriptionSource | null> {
  const k = key();
  if (!k) return null;
  const video = await freshVideo(url);
  if (!video?.videoUrl) {
    console.error("[assemblyai] no video link from the scrapers for", url);
    return null;
  }
  if (video.hasAudio === false) {
    return { id: AAI_PREFIX + "none", kind: "video", title: "", origin: url, transcript: "", status: "error", error: "No spoken audio in this reel." };
  }
  const res = await fetch(API, {
    method: "POST",
    headers: { authorization: k, "content-type": "application/json" },
    body: JSON.stringify({ audio_url: video.videoUrl, language_detection: true }),
  });
  if (!res.ok) {
    console.error("[assemblyai] start failed", res.status, (await res.text()).slice(0, 200));
    return null;
  }
  const j = (await res.json()) as { id?: string };
  if (!j.id) return null;
  return { id: AAI_PREFIX + j.id, kind: "video", title: "", origin: url, transcript: "", status: "processing", error: null };
}

export async function getAssemblyStatus(id: string): Promise<TranscriptionSource> {
  if (id === AAI_PREFIX + "none") return { id, kind: "video", title: "", origin: "", transcript: "", status: "error", error: "No spoken audio in this reel." };
  const k = key();
  if (!k) throw new Error("ASSEMBLYAI_API_KEY is not set.");
  const res = await fetch(`${API}/${id.slice(AAI_PREFIX.length)}`, { headers: { authorization: k } });
  if (!res.ok) throw new Error(`Transcription status check failed (${res.status})`);
  const j = (await res.json()) as { status?: string; text?: string | null; error?: string | null };
  const base = { id, kind: "video", title: "", origin: "" };
  if (j.status === "completed") {
    const text = (j.text ?? "").trim();
    return text
      ? { ...base, transcript: text, status: "ready", error: null }
      : { ...base, transcript: "", status: "error", error: "No spoken audio in this reel." };
  }
  if (j.status === "error") return { ...base, transcript: "", status: "error", error: j.error || "Couldn't transcribe this reel." };
  return { ...base, transcript: "", status: "processing", error: null };
}
