"use client";

// Library and Creators are one page: this switch changes the view without leaving it, so the top never jumps.
export type LibraryMode = "posts" | "creators";

export function LibraryTabs({ active, onChange, compact = false }: { active: LibraryMode; onChange: (m: LibraryMode) => void; compact?: boolean }) {
  const tab = (key: LibraryMode, label: string) => (
    <button
      type="button"
      onClick={() => onChange(key)}
      className={`flex ${compact ? "h-[34px] px-3 text-[13px]" : "h-9 px-4 text-[14px]"} flex-1 items-center justify-center rounded font-extrabold md:flex-none ${
        active === key ? "bg-[#0D0D0D] text-white" : "text-[#4a4a48] hover:bg-[#F0F0F1]"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex gap-0.5 rounded-md border border-[#E4E4E2] bg-white p-0.5">
      {tab("posts", "Posts")}
      {tab("creators", "Creators")}
    </div>
  );
}
