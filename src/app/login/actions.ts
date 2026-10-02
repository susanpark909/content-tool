"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, SESSION_ONLY_COOKIE } from "@/lib/supabase/server";

type FormState = { error?: string; message?: string } | null;

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";
  if (!email || !password) return { error: "Enter your email and password." };

  const cookieStore = await cookies();
  if (remember) cookieStore.delete(SESSION_ONLY_COOKIE);
  else cookieStore.set(SESSION_ONLY_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax" });

  const supabase = await createClient({ sessionOnly: !remember });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "That email or password isn't right." };
  redirect("/");
}

// Only works until the first account exists - this is a one-person tool, so
// after that the page just says sign-ups are closed.
export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!email || !password) return { error: "Enter your email and a password." };
  if (password.length < 8) return { error: "Use at least 8 characters for the password." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const { count } = await supabase.from("ct_owner").select("user_id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return { error: "Sign-ups are closed. This workspace already has an account." };

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  if (data.user) {
    const { error: ownerError } = await supabase.from("ct_owner").insert({ user_id: data.user.id });
    if (ownerError) return { error: "Account created, but couldn't finish setup. Try signing in." };
  }
  if (data.session) redirect("/");
  return { message: "Account created. Check your email to confirm it, then sign in." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
