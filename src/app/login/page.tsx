"use client";

import { useActionState } from "react";
import Image from "next/image";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#FBFBFA] p-6">
      <form
        action={action}
        className="flex w-full max-w-[380px] flex-col gap-4 rounded-lg border border-[#F0F0F1] bg-white p-8 shadow-[0_4px_16px_rgba(13,13,13,0.09)]"
      >
        <div className="rounded bg-[#0D0D0D] px-4 py-3">
          <Image src="/brand/viral-heist-logo.png" alt="Viral Heist" width={150} height={22} priority />
        </div>
        <h1 className="text-[28px] leading-none font-black tracking-[-0.03em]">Sign in</h1>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#4a4a48]">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-[46px] rounded-md border border-[#E4E4E2] px-3 text-sm font-semibold text-[#0D0D0D] outline-none focus:border-[#0D0D0D]"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-[#4a4a48]">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-[46px] rounded-md border border-[#E4E4E2] px-3 text-sm font-semibold text-[#0D0D0D] outline-none focus:border-[#0D0D0D]"
          />
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
    </div>
  );
}
