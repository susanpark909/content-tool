"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { cn } from "@/lib/utils";
import { MaterialIcon } from "@/components/ui/material-icon";

const links = [
  { href: "/", label: "Goals", icon: "flag" },
  { href: "/idea", label: "Idea", icon: "lightbulb" },
  { href: "/analyze-reel", label: "Analyze Reel", icon: "query_stats" },
  { href: "/reels", label: "All Reels", icon: "video_library" },
  { href: "/library", label: "Library", icon: "account_tree" },
];

const CALENDAR_LINK = { href: "/calendar", label: "Calendar", icon: "calendar_month" };

// Sidebar groups (preview of the plan). "soon" pages aren't built yet: shown muted, not clickable.
type NavLink = { href: string; label: string; icon: string; soon?: boolean };
const HOME_LINK: NavLink = { href: "/", label: "Home", icon: "home" };
const GROUPS: { heading: string; links: NavLink[] }[] = [
  {
    heading: "Capture",
    links: [
      { href: "/idea", label: "Ideas", icon: "lightbulb" },
      { href: "#queue", label: "Reel Queue", icon: "inbox", soon: true },
    ],
  },
  {
    heading: "Analyze",
    links: [
      { href: "/analyze-reel", label: "Analyze Reel", icon: "query_stats" },
      { href: "/reels", label: "All Reels", icon: "video_library" },
      { href: "#channels", label: "Channels", icon: "groups", soon: true },
    ],
  },
  {
    heading: "Write",
    links: [
      { href: "/scripts", label: "Scripts", icon: "edit_note" },
      { href: "/library", label: "Hook Vault", icon: "key" },
    ],
  },
  {
    heading: "Plan",
    links: [
      CALENDAR_LINK,
      { href: "#board", label: "Content Board", icon: "view_kanban", soon: true },
    ],
  },
];

const COLLAPSE_KEY = "rc-nav";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/reels" && pathname.startsWith("/boards")) return true;
  return pathname === href || pathname.startsWith(href + "/");
}

export function SiteNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const onLogin = pathname === "/login" || pathname === "/signup";

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "0");
    } catch {}
  }, []);

  // Remember the page you were on before this one, so Back links can say (and
  // go) exactly where you came from.
  useEffect(() => {
    try {
      const last = sessionStorage.getItem("vh-last-path");
      if (last && last !== pathname) sessionStorage.setItem("vh-prev-path", last);
      sessionStorage.setItem("vh-last-path", pathname);
    } catch {}
  }, [pathname]);

  // Close the phone menu whenever you go to another page.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "0" : "1");
      } catch {}
      return next;
    });
  }

  if (onLogin) return null;

  return (
    <>
      {/* Mobile top bar: logo + hamburger */}
      <header className="sticky top-0 z-40 border-b border-[#1e1e1e] bg-[#0D0D0D] md:hidden">
        <div className="flex h-12 items-center justify-between px-4">
          <Link href="/" className="shrink-0">
            <Image src="/brand/viral-heist-logo.png" alt="Viral Heist" width={120} height={17} priority />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex size-9 items-center justify-center rounded-md text-white hover:bg-[#1E1E1E]"
          >
            <MaterialIcon name={menuOpen ? "close" : "menu"} size={24} />
          </button>
        </div>
        {menuOpen && (
          <nav className="absolute top-full right-0 left-0 flex flex-col gap-0.5 border-b border-[#1e1e1e] bg-[#0D0D0D] px-3 pt-1 pb-3 shadow-[0_16px_32px_rgba(0,0,0,0.45)]">
            {[{ heading: "", links: [HOME_LINK] }, ...GROUPS, { heading: "", links: [{ href: "/settings", label: "Settings", icon: "settings" }] }].map((group, gi) => (
              <div key={group.heading || gi} className="flex flex-col gap-0.5">
                {group.heading && (
                  <div className="px-3 pt-2.5 pb-0.5 text-[10.5px] font-bold tracking-[0.12em] text-[#9a9a98] uppercase">{group.heading}</div>
                )}
                {group.links.map((link) => {
              if ((link as NavLink).soon) {
                return (
                  <div key={link.href} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium text-[#6b6b69]">
                    <MaterialIcon name={link.icon} size={20} />
                    {link.label}
                    <span className="ml-auto rounded-lg border border-[#3a3a38] px-1.5 text-[9px] font-bold tracking-wide text-[#8a8a88]">SOON</span>
                  </div>
                );
              }
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium text-[#D4D4D2]",
                    active && "bg-[#FF1F8F] font-bold text-[#0D0D0D]",
                  )}
                >
                  <MaterialIcon name={link.icon} size={20} />
                  {link.label}
                </Link>
              );
                })}
              </div>
            ))}
            <form action={signOut} className="mt-1 border-t border-[#1e1e1e] pt-1">
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium text-[#BDBDBB]"
              >
                <MaterialIcon name="logout" size={20} />
                Sign out
              </button>
            </form>
          </nav>
        )}
      </header>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden bg-[#0D0D0D] transition-[width] duration-150 md:flex",
          collapsed ? "w-[68px]" : "w-[186px]",
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-no-repeat"
          style={{
            backgroundImage: "url(/brand/sidebar-paint.png)",
            backgroundSize: "auto 100%",
            backgroundPosition: "right -85px bottom",
          }}
        />

        <div className="relative flex h-full flex-col pt-6 pb-3.5">
          <div className={cn("flex items-center px-[14px] pb-6", collapsed && "justify-center px-0")}>
            <Link href="/" className="flex items-center">
              {collapsed ? (
                <Image src="/brand/viral-heist-mark.png" alt="Viral Heist" width={36} height={36} className="rounded-[8px]" priority />
              ) : (
                <Image src="/brand/viral-heist-logo.png" alt="Viral Heist" width={150} height={22} priority />
              )}
            </Link>
          </div>

          <nav className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2.5 text-sm font-medium [scrollbar-width:none]">
            {[{ heading: "", links: [HOME_LINK] }, ...GROUPS].map((group) => (
              <div key={group.heading || "home"} className={cn("flex flex-col gap-0.5", group.heading && "mt-4")}>
                {group.heading && !collapsed && (
                  <div className="px-3 pb-2 text-[11px] font-semibold tracking-[0.1em] text-[#a8a8a6] uppercase">
                    {group.heading}
                  </div>
                )}
                {group.links.map((link) => {
                  const active = !link.soon && isActive(pathname, link.href);
                  if (link.soon) {
                    return (
                      <div
                        key={link.href}
                        title={collapsed ? `${link.label} (coming soon)` : "Coming soon"}
                        className={cn("flex cursor-default items-center gap-3 rounded-md px-3 py-2.5 text-[#6b6b69]", collapsed && "justify-center px-0")}
                      >
                        <MaterialIcon name={link.icon} size={19} />
                        {!collapsed && (
                          <>
                            <span>{link.label}</span>
                          </>
                        )}
                      </div>
                    );
                  }
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      title={collapsed ? link.label : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-[#D4D4D2] hover:text-[#FF1F8F]",
                        collapsed && "justify-center px-0",
                        active && "bg-[#FF1F8F] font-bold text-[#0D0D0D] hover:text-[#0D0D0D]",
                      )}
                    >
                      <MaterialIcon name={link.icon} size={19} />
                      {!collapsed && <span>{link.label}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-5 px-3.5">
            <div className={cn("flex", collapsed ? "justify-center" : "justify-end")}>
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="flex size-7 cursor-pointer items-center justify-center rounded-full border-2 border-[#E4FF1A] text-[22px] leading-none text-[#E4FF1A] hover:bg-[#E4FF1A]/10"
                style={{
                  fontFamily: "'Material Symbols Outlined'",
                  fontVariationSettings: "'wght' 700, 'GRAD' 200, 'opsz' 48",
                  WebkitTextStroke: "1.5px #E4FF1A",
                }}
              >
                {collapsed ? "chevron_right" : "chevron_left"}
              </button>
            </div>
            <Link
              href="/settings"
              title={collapsed ? "Settings" : undefined}
              className={cn(
                "flex items-center justify-between rounded-[10px] bg-[#1E1E1E] px-3 py-2.5 hover:bg-[#262626]",
                collapsed && "justify-center px-0",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-[#3a3a38] text-[11px] font-bold text-[#EDEDEB]">
                  SP
                  <span className="absolute -right-px -bottom-px size-2.5 rounded-full bg-[#C6FF3D] ring-2 ring-[#1E1E1E]" />
                </span>
                {!collapsed && (
                  <span className="text-[13px] font-semibold text-[#EDEDEB]">Susan</span>
                )}
              </div>
              {!collapsed && (
                <span className="text-[#BDBDBB]">
                  <MaterialIcon name="settings" size={19} />
                </span>
              )}
            </Link>
            {!collapsed && (
              <form action={signOut}>
                <button type="submit" className="mt-2 w-full text-left text-xs font-semibold text-[#BDBDBB] hover:text-[#FF1F8F]">
                  Sign out
                </button>
              </form>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
