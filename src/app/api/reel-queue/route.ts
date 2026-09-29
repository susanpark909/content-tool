import { NextRequest, NextResponse } from "next/server";
import { queueAndAnalyzeReel } from "@/lib/reel-queue";

// POST /api/reel-queue
// Header:  Authorization: Bearer <QUEUE_API_SECRET>
// Body:    { "url": "https://www.instagram.com/reel/DdXxxxxxx/" }
//
// Called from an iPhone Shortcut's "Get Contents of URL" action when a reel
// is shared in from the phone. Inserts a queue row immediately, then runs
// the same single-reel Apify pull used by "Analyze reels by URL" so stats
// are already populated by the time the Queue page is opened.
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

  const result = await queueAndAnalyzeReel(rawUrl);

  if (result.status === "error") {
    return NextResponse.json({ ok: false, ...result }, { status: 502 });
  }
  return NextResponse.json({ ok: true, ...result });
}
