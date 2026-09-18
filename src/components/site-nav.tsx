import Link from "next/link";

const links = [
  { href: "/journal", label: "Idea Journal" },
  { href: "/research", label: "Research" },
  { href: "/hooks", label: "Hook Library" },
  { href: "/frameworks", label: "Framework Library" },
];

export function SiteNav() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <Link href="/" className="font-semibold">
          Content Tool
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
