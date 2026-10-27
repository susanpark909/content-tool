import { AAI_PREFIX, assemblyEnabled, getAssemblyStatus, startAssembly } from "@/lib/assemblyai";
import { GROQ_PREFIX, getGroqStatus } from "@/lib/groq";

export type TranscriptionSource = {
  id: string;
  kind: string;
  title: string;
  origin: string;
  transcript: string;
  status: "processing" | "ready" | "error";
  error: string | null;
};

function authHeader() {
  const user = process.env.TRANSCRIPTION_API_USERNAME;
  const pass = process.env.TRANSCRIPTION_API_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "TRANSCRIPTION_API_USERNAME / TRANSCRIPTION_API_PASSWORD are not set. Add them to .env.local and restart the dev server.",
    );
  }
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

function baseUrl() {
  const base = process.env.TRANSCRIPTION_API_URL;
  if (!base) {
    throw new Error(
      "TRANSCRIPTION_API_URL is not set. Add it to .env.local and restart the dev server.",
    );
  }
  return base;
}

export async function startTranscription(
  url: string,
  owner?: string | null,
  window?: number,
): Promise<TranscriptionSource> {
  // straight to AssemblyAI when it's set up; the older transcription tool is the fallback
  if (!assemblyEnabled()) console.error("[assemblyai] not enabled here: key or scraper token missing");
  if (assemblyEnabled()) {
    try {
      const direct = await startAssembly(url, owner, window);
      if (direct) return direct;
    } catch (e) {
      console.error("[assemblyai] fell back to the older tool:", e instanceof Error ? e.message : e);
    }
  }
  const response = await fetch(`${baseUrl()}/api/sources/video`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Transcription request failed (${response.status}): ${body}`);
  }

  return response.json();
}

export async function getTranscriptionStatus(
  id: string,
): Promise<TranscriptionSource> {
  if (id.startsWith(GROQ_PREFIX)) return getGroqStatus(id);
  if (id.startsWith(AAI_PREFIX)) return getAssemblyStatus(id);
  const response = await fetch(`${baseUrl()}/api/sources/${id}`, {
    headers: { Authorization: authHeader() },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Transcription status check failed (${response.status}): ${body}`);
  }

  return response.json();
}
