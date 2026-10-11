import { NextRequest, NextResponse } from "next/server";
import { queueReelLink } from "@/lib/reel-queue";

// POST /api/reel-queue
// Header:  Authorization: Bearer <QUEUE_API_SECRET>
// Body:    { "url": "https://www.instagram.com/reel/DdXxxxxxx/" }
//
// Called from an iPhone Shortcut's "Get Contents of URL" action when a reel
// is shared in from the phone. Saves the link to the Queue right away (plus the free preview info:
// creator, caption, date, picture), then fills in the public numbers (views, likes, comments, length)
// with one cheap scraper look. Shares, saves and the transcript come when you press Analyze.
// the cheap numbers are filled in after the response, which can take up to a minute
export const maxDuration = 120;

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

  const result = await queueReelLink(rawUrl);

  if (result.status === "error") {
    return NextResponse.json({ ok: false, ...result }, { status: 502 });
  }
  return NextResponse.json({ ok: true, ...result });
}
