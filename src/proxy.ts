import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Gate: everything needs a signed-in user except the login page and the
// phone-share endpoint (which has its own secret).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          const sessionOnly = request.cookies.get("vh-session")?.value === "1";
          cookiesToSet.forEach(({ name, value, options }) => {
            const o = options ? { ...options } : options;
            if (sessionOnly && o) {
              delete o.maxAge;
              delete o.expires;
            }
            response.cookies.set(name, value, o);
          });
        },
      },
    },
  );

  // getClaims checks the session token locally when it can, instead of a
  // round trip to Supabase on every single page request.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims ?? null;

  const path = request.nextUrl.pathname;
  const onLogin = path === "/login" || path === "/signup";
  if (!user && !onLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && onLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!api/reel-queue|_next/static|_next/image|brand/|favicon.ico|.*\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
