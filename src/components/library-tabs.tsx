import Link from "next/link";

// Library and Creators are one place: this switch sits at the top of both pages.
export function LibraryTabs({ active, tall = false, compact = false }: { active: "posts" | "creators"; tall?: boolean; compact?: boolean }) {
  const tab = (key: "posts" | "creators", href: string, label: string) => (
    <Link
      href={href}
      className={`flex ${tall ? "h-[38px]" : compact ? "h-[34px]" : "h-9"} flex-1 items-center justify-center rounded ${compact ? "px-3 text-[13px]" : "px-4 text-[14px]"} font-extrabold md:flex-none ${
        active === key ? "bg-[#0D0D0D] text-white" : "text-[#4a4a48] hover:bg-[#F0F0F1]"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex gap-0.5 rounded-md border border-[#E4E4E2] bg-white p-0.5">
      {tab("posts", "/reels", "Posts")}
      {tab("creators", "/creators", "Creators")}
    </div>
  );
}
