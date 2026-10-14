import { NextResponse, type NextRequest } from "next/server";
import { igAuthUrl, igConfigured } from "@/lib/instagram-api";

// Sends you to Instagram to say "yes, VH can read my reel numbers".
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (!igConfigured()) return NextResponse.redirect(`${origin}/settings?ig=notready`);
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(igAuthUrl(`${origin}/api/instagram/callback`, state));
  res.cookies.set("ig_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
