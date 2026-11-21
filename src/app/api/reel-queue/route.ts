import { NextRequest, NextResponse } from "next/server";
import { queueReelLink } from "@/lib/reel-queue";
import { startQueueAnalysis } from "@/app/analyze-reel/queue-actions";

// POST /api/reel-queue
// Header:  Authorization: Bearer <QUEUE_API_SECRET>
// Body:    { "url": "https://www.instagram.com/reel/DdXxxxxxx/", "note": "why I saved it" }   (note is optional)
//
// Called from an iPhone Shortcut's "Get Contents of URL" action when a reel is shared in from the phone.
// Saves the link (plus the free preview info: creator, caption, date, picture) and the note, then starts the
// full analysis and transcription right away in the background, so nothing waits in the Queue to be pressed.
// The analysis keeps running after the response, which can take up to a minute.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = process.env.QUEUE_API_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing "url" in request body' }, { status: 400 });
  }

  // the phone keyboard likes to capitalize the field name, so "Note" counts too
  const rawNote = body?.note ?? body?.Note;
  const saveNote = typeof rawNote === "string" ? rawNote.trim().slice(0, 1000) : "";
  // The reel goes straight into analyzing (and transcribing). The separate cheap look is skipped:
  // the full pull already returns everything, so running both would be two charges.
  const result = await queueReelLink(rawUrl, { saveNote, skipCheapLook: true });

  if (result.status === "error") {
    return NextResponse.json({ ok: false, ...result }, { status: 502 });
  }
  if (result.id) await startQueueAnalysis([result.id]);
  return NextResponse.json({ ok: true, ...result });
}
