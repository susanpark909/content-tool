import type { TranscriptionSource } from "@/lib/transcription";

// Groq's hosted Whisper (whisper-large-v3-turbo, about $0.04 per hour of audio, with a free tier).
// It answers straight away instead of in the background, so the finished text rides inside the saved id
// and the status check just unpacks it. Any failure returns null so AssemblyAI takes over.
const API = "https://api.groq.com/openai/v1/audio/transcriptions";
export const GROQ_PREFIX = "groq:";

export const groqEnabled = () => !!process.env.GROQ_API_KEY;

export async function transcribeWithGroq(videoUrl: string, origin: string): Promise<TranscriptionSource | null> {
  const k = process.env.GROQ_API_KEY;
  if (!k) return null;
  try {
    const video = await fetch(videoUrl, { signal: AbortSignal.timeout(30_000) });
    if (!video.ok) {
      console.error("[groq] video download failed", video.status);
      return null;
    }
    const form = new FormData();
    form.append("file", await video.blob(), "reel.mp4");
    form.append("model", "whisper-large-v3-turbo");
    form.append("response_format", "json");
    const res = await fetch(API, { method: "POST", headers: { authorization: `Bearer ${k}` }, body: form, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      console.error("[groq] failed", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const text = (((await res.json()) as { text?: string }).text ?? "").trim();
    if (!text) return { id: GROQ_PREFIX + "none", kind: "video", title: "", origin, transcript: "", status: "error", error: "No spoken audio in this reel." };
    return { id: GROQ_PREFIX + Buffer.from(text, "utf8").toString("base64url"), kind: "video", title: "", origin, transcript: text, status: "ready", error: null };
  } catch (e) {
    console.error("[groq] failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export function getGroqStatus(id: string): TranscriptionSource {
  const base = { id, kind: "video", title: "", origin: "" };
  const packed = id.slice(GROQ_PREFIX.length);
  if (packed === "none") return { ...base, transcript: "", status: "error", error: "No spoken audio in this reel." };
  return { ...base, transcript: Buffer.from(packed, "base64url").toString("utf8"), status: "ready", error: null };
}
