import Link from "next/link";

// Library and Creators are one place: this switch sits at the top of both pages.
export function LibraryTabs({ active }: { active: "posts" | "creators" }) {
  const tab = (key: "posts" | "creators", href: string, label: string) => (
    <Link
      href={href}
      className={`flex h-10 flex-1 items-center justify-center rounded-md px-5 text-[14px] font-extrabold md:flex-none ${
        active === key ? "bg-[#0D0D0D] text-white" : "text-[#4a4a48] hover:bg-[#F0F0F1]"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex w-full gap-1 rounded-lg border border-[#E4E4E2] bg-white p-1 md:w-fit">
      {tab("posts", "/reels", "Posts")}
      {tab("creators", "/creators", "Creators")}
    </div>
  );
}
