"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SettingsIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/journal", label: "Idea" },
  { href: "/research", label: "Analyze" },
  { href: "/reels", label: "All Reels" },
  { href: "/library", label: "Frameworks" },
  { href: "/plan", label: "Calendar" },
];

const COLLAPSE_KEY = "ct-sidebar-collapsed";

export function SiteNav() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }

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

      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r transition-[width] duration-150 md:flex",
          collapsed ? "w-14" : "w-56",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-2">
          {!collapsed && (
            <Link href="/" className="truncate px-2 font-semibold">
              Content Tool
            </Link>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex shrink-0 items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {collapsed ? (
              <ChevronRightIcon className="h-4 w-4" />
            ) : (
              <ChevronLeftIcon className="h-4 w-4" />
            )}
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2 py-2 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              title={collapsed ? link.label : undefined}
              className={cn(
                "truncate rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "px-0 text-center text-xs",
              )}
            >
              {collapsed ? link.label.charAt(0) : link.label}
            </Link>
          ))}
        </nav>
        <div className="shrink-0 border-t px-2 py-2">
          <Link
            href="/settings"
            title={collapsed ? "Settings" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            <SettingsIcon className="h-4 w-4 shrink-0" />
            {!collapsed && "Settings"}
          </Link>
        </div>
      </aside>
    </>
  );
}
