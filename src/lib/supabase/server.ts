import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// "Stay logged in" unchecked => session cookies (gone when the browser closes).
// The vh-session flag cookie remembers that choice for later token refreshes.
export const SESSION_ONLY_COOKIE = "vh-session";

export async function createClient(opts?: { sessionOnly?: boolean }) {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          const sessionOnly = opts?.sessionOnly ?? false; // always stay signed in until Sign out
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const o = options ? { ...options } : options;
              if (sessionOnly && o) {
                delete o.maxAge;
                delete o.expires;
              }
              cookieStore.set(name, value, o);
            });
          } catch {
            // setAll called from a Server Component; safe to ignore
            // when middleware is refreshing sessions.
          }
        },
      },
    },
  );
}
