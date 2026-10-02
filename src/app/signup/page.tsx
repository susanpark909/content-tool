"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/app/login/actions";
import { AuthCard, authInput } from "@/app/login/auth-card";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUp, null);
  return (
    <AuthCard title="Create an account">
      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#4a4a48]">
          Email
          <input name="email" type="email" autoComplete="email" required className={authInput} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#4a4a48]">
          Password
          <input name="password" type="password" autoComplete="new-password" minLength={8} required className={authInput} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#4a4a48]">
          Confirm password
          <input name="confirm" type="password" autoComplete="new-password" minLength={8} required className={authInput} />
        </label>
        {state?.error && <p className="text-sm font-semibold text-[#D10A6E]">{state.error}</p>}
        {state?.message && <p className="text-sm font-semibold text-[#2f7a00]">{state.message}</p>}
        <button
          type="submit"
          disabled={pending}
          className="h-[46px] rounded-md bg-[#FF1F8F] text-sm font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F]"
        >
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="text-center text-[13px] font-semibold text-[#4a4a48]">
        Already have one?{" "}
        <Link href="/login" className="font-bold text-[#0D0D0D] underline hover:text-[#FF1F8F]">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
