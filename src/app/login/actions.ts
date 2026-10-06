"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, SESSION_ONLY_COOKIE } from "@/lib/supabase/server";

type FormState = { error?: string; message?: string } | null;

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  // Always stay signed in until you press Sign out. (Clears any old "session only"
  // flag from when the checkbox existed.)
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_ONLY_COOKIE);

  const supabase = await createClient({ sessionOnly: false });
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
