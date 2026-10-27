import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const API = "https://api.assemblyai.com/v2";
// a request body can be at most about 4.5 MB on Vercel; a few minutes of voice is well under that
const MAX_BYTES = 4_000_000;

// Voice typing: the microphone button records, sends the recording here when you tap stop, and gets the text back.
// The recording is sent to AssemblyAI (the same service that transcribes reels) and is not stored here.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) return Response.json({ error: "Voice typing isn't set up yet." }, { status: 500 });

  const audio = await req.arrayBuffer();
  if (audio.byteLength < 1500) return Response.json({ text: "" });
  if (audio.byteLength > MAX_BYTES) return Response.json({ error: "That recording is too long. Keep it under 3 minutes." }, { status: 413 });

  try {
    const up = await fetch(`${API}/upload`, { method: "POST", headers: { authorization: key, "content-type": "application/octet-stream" }, body: audio });
    if (!up.ok) throw new Error(`upload ${up.status}`);
    const { upload_url } = (await up.json()) as { upload_url?: string };
    if (!upload_url) throw new Error("no upload url");

    const start = await fetch(`${API}/transcript`, {
      method: "POST",
      headers: { authorization: key, "content-type": "application/json" },
      body: JSON.stringify({ audio_url: upload_url, language_detection: true }),
    });
    if (!start.ok) throw new Error(`start ${start.status}`);
    const { id } = (await start.json()) as { id?: string };
    if (!id) throw new Error("no transcript id");

    const until = Date.now() + 50_000;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, 900));
      const res = await fetch(`${API}/transcript/${id}`, { headers: { authorization: key } });
      if (!res.ok) continue;
      const j = (await res.json()) as { status?: string; text?: string | null; error?: string | null };
      if (j.status === "completed") return Response.json({ text: (j.text ?? "").trim() });
      if (j.status === "error") throw new Error(j.error || "transcription failed");
    }
    throw new Error("timed out");
  } catch (e) {
    console.error("[dictate]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Couldn't turn that into text. Try again." }, { status: 502 });
  }
}
