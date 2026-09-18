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
): Promise<TranscriptionSource> {
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
  const response = await fetch(`${baseUrl()}/api/sources/${id}`, {
    headers: { Authorization: authHeader() },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Transcription status check failed (${response.status}): ${body}`);
  }

  return response.json();
}
