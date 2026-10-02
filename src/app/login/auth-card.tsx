import Image from "next/image";

export const authInput =
  "h-[46px] rounded-md border border-[#E4E4E2] px-3 text-sm font-semibold text-[#0D0D0D] outline-none focus:border-[#0D0D0D]";

export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#FBFBFA] p-6">
      <div className="flex w-full max-w-[380px] flex-col gap-4 rounded-lg border border-[#F0F0F1] bg-white p-8 shadow-[0_4px_16px_rgba(13,13,13,0.09)]">
        <div className="rounded bg-[#0D0D0D] px-4 py-3">
          <Image src="/brand/viral-heist-logo.png" alt="Viral Heist" width={150} height={22} priority />
        </div>
        <h1 className="text-[28px] leading-none font-black tracking-[-0.03em]">{title}</h1>
        {children}
      </div>
    </div>
  );
}
