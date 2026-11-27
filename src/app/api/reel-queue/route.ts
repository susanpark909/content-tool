import { NextRequest, NextResponse } from "next/server";
import { queueReelLink } from "@/lib/reel-queue";
import { startQueueAnalysis } from "@/app/analyze-reel/queue-actions";
import { createClient } from "@/lib/supabase/server";

// POST /api/reel-queue
// Header:  Authorization: Bearer <QUEUE_API_SECRET>
// Body:    { "url": "https://www.instagram.com/reel/DdXxxxxxx/", "note": "why I saved it" }   (note is optional)
//
// Called from an iPhone Shortcut's "Get Contents of URL" action when a reel is shared in from the phone.
// Saves the link (plus the free preview info: creator, caption, date, picture) and the note, then starts the
// full analysis and transcription right away in the background, so nothing waits in the Queue to be pressed.
// The analysis keeps running after the response, which can take up to a minute.
//
// Every share is written to ct_share_log exactly as it arrived (the raw body), so a note can never be lost
// just because the phone sent it under a different name: it can be read back and saved from there.
export const maxDuration = 60;

// the phone sends JSON, but a Shortcut set to "Form" sends name=value pairs: read either
function parseBody(text: string): Record<string, unknown> | null {
  const t = text.trim();
  if (!t) return null;
  try {
    const j = JSON.parse(t);
    if (j && typeof j === "object") return j as Record<string, unknown>;
  } catch {}
  try {
    const params = new URLSearchParams(t);
    const out: Record<string, unknown> = {};
    params.forEach((v, k) => (out[k] = v));
    if (Object.keys(out).length > 0) return out;
  } catch {}
  return null;
}

// the note can come under several names (the phone keyboard capitalizes, people type "notes"): take the first that has text
const NOTE_KEYS = ["note", "notes", "why", "reason", "why i saved it", "save_note", "savenote", "comment", "text", "message"];
function findNote(body: Record<string, unknown> | null): string {
  if (!body) return "";
  const lower = new Map(Object.entries(body).map(([k, v]) => [k.trim().toLowerCase(), v]));
  for (const k of NOTE_KEYS) {
    const v = lower.get(k);
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 1000);
  }
  return "";
}

export async function POST(req: NextRequest) {
  const secret = process.env.QUEUE_API_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawText = await req.text().catch(() => "");
  const body = parseBody(rawText);
  const urlField = body ? [...Object.entries(body)].find(([k]) => k.trim().toLowerCase() === "url")?.[1] : null;
  const rawUrl = typeof urlField === "string" ? urlField.trim() : "";
  const saveNote = findNote(body);

  // keep a copy of what arrived, before anything else can go wrong
  const supabase = await createClient();
  const logged = await supabase
    .from("ct_share_log")
    .insert({ url: rawUrl || null, body_keys: body ? Object.keys(body).join(", ") : "(unreadable)", raw_body: rawText.slice(0, 4000), note_found: saveNote || null, outcome: "received" })
    .select("id")
    .single();
  const logId = logged.data?.id as string | undefined;
  const finish = async (outcome: string) => {
    if (logId) await supabase.from("ct_share_log").update({ outcome }).eq("id", logId);
  };

  if (!rawUrl) {
    await finish("no url in the body");
    return NextResponse.json({ error: 'Missing "url" in request body' }, { status: 400 });
  }

  // The reel goes straight into analyzing (and transcribing). The separate cheap look is skipped:
  // the full pull already returns everything, so running both would be two charges.
  const result = await queueReelLink(rawUrl, { saveNote, skipCheapLook: true });

  if (result.status === "error") {
    await finish("error: " + (result.error ?? ""));
    return NextResponse.json({ ok: false, ...result }, { status: 502 });
  }
  await finish(saveNote ? "saved with note" : "saved, no note sent");
  if (result.id) await startQueueAnalysis([result.id]);
  return NextResponse.json({ ok: true, ...result });
}
