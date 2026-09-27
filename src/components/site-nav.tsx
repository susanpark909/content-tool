import Link from "next/link";
import { SettingsIcon } from "lucide-react";

const links = [
  { href: "/journal", label: "Idea" },
  { href: "/research", label: "Analyze" },
  { href: "/reels", label: "All Reels" },
  { href: "/library", label: "Frameworks" },
  { href: "/plan", label: "Plan" },
];

export function SiteNav() {
  return (
    <>
      <header className="border-b md:hidden">
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
            <Link href="/settings" className="shrink-0 hover:text-foreground">
              Settings
            </Link>
          </nav>
        </div>
      </header>

      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r md:flex">
        <Link href="/" className="flex h-14 shrink-0 items-center px-4 font-semibold">
          Content Tool
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-2 py-2 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="shrink-0 border-t px-2 py-2">
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <SettingsIcon className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </aside>
    </>
  );
}
