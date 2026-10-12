import type { TranscriptionSource } from "@/lib/transcription";

// Direct AssemblyAI transcription. Instagram's own video links expire within hours, so a link is never saved:
// when a reel is analyzed we ask the scraper for a fresh one and hand it straight to AssemblyAI.
// Anything missing or failing returns null so the caller can fall back to the older transcription tool.
const REELS_ACTOR = "scrapesage~instagram-reels-scraper";
const API = "https://api.assemblyai.com/v2/transcript";
export const AAI_PREFIX = "aai:";

const key = () => process.env.ASSEMBLYAI_API_KEY || null;
export const assemblyEnabled = () => !!key() && !!process.env.APIFY_API_TOKEN;

async function freshVideo(url: string): Promise<{ videoUrl: string | null; hasAudio: boolean | null } | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;
  const res = await fetch(`https://api.apify.com/v2/acts/${REELS_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=100`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reelUrls: [url], includeReelDetails: false, maxResults: 1 }),
    // never let the link lookup eat the whole request: past this, the older tool takes over
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;
  const o = ((await res.json()) as Record<string, unknown>[])?.[0];
  if (!o) return null;
  return { videoUrl: typeof o.videoUrl === "string" && o.videoUrl ? o.videoUrl : null, hasAudio: typeof o.hasAudio === "boolean" ? o.hasAudio : null };
}

export async function startAssembly(url: string): Promise<TranscriptionSource | null> {
  const k = key();
  if (!k) return null;
  const video = await freshVideo(url);
  if (!video?.videoUrl) return null;
  if (video.hasAudio === false) {
    return { id: AAI_PREFIX + "none", kind: "video", title: "", origin: url, transcript: "", status: "error", error: "No spoken audio in this reel." };
  }
  const res = await fetch(API, {
    method: "POST",
    headers: { authorization: k, "content-type": "application/json" },
    body: JSON.stringify({ audio_url: video.videoUrl, language_detection: true }),
  });
  if (!res.ok) return null;
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
