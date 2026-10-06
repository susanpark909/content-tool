"use client";

import { useActionState } from "react";
import { signIn } from "./actions";
import { AuthCard, authInput } from "./auth-card";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <AuthCard title="Sign in">
      <form action={action} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#4a4a48]">
          Email
          <input name="email" type="email" autoComplete="email" required className={authInput} />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#4a4a48]">
          Password
          <input name="password" type="password" autoComplete="current-password" required className={authInput} />
        </label>
        {state?.error && <p className="text-sm font-semibold text-[#D10A6E]">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="h-[46px] rounded-md bg-[#FF1F8F] text-sm font-extrabold text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-[#FF1F8F]"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthCard>
  );
}
