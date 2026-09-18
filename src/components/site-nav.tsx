import Link from "next/link";

const links = [
  { href: "/journal", label: "Idea" },
  { href: "/research", label: "Analyze" },
  { href: "/reels", label: "All Reels" },
  { href: "/library", label: "Frameworks" },
  { href: "/create", label: "Create" },
  { href: "/brand", label: "Brand Profile" },
  { href: "/create/process", label: "Instructions" },
];

export function SiteNav() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:gap-6">
        <Link href="/" className="shrink-0 font-semibold">
          Content Tool
        </Link>
        <nav className="flex min-w-0 flex-1 gap-4 overflow-x-auto text-sm whitespace-nowrap text-muted-foreground">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
