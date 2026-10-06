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

// Sign-up is closed: this app is just for its owner. (The old sign-up code is in git history.)
export async function signUp(_prev: FormState, _formData: FormData): Promise<FormState> {
  void _prev;
  void _formData;
  return { error: "Sign-up is closed." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
