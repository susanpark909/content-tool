"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MaterialIcon } from "@/components/ui/material-icon";

const links = [
  { href: "/", label: "Goals", icon: "flag" },
  { href: "/journal", label: "Idea", icon: "lightbulb" },
  { href: "/research", label: "Analyze Reel", icon: "query_stats" },
  { href: "/reels", label: "All Reels", icon: "video_library" },
  { href: "/library", label: "Library", icon: "account_tree" },
];

const CALENDAR_LINK = { href: "/plan", label: "Calendar", icon: "calendar_month" };

const COLLAPSE_KEY = "rc-nav";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function SiteNav() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "0");
    } catch {}
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "0" : "1");
      } catch {}
      return next;
    });
  }

  return (
    <>
      {/* Mobile top bar */}
      <header className="border-b border-[#1e1e1e] bg-[#0D0D0D] md:hidden">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:gap-6">
          <Link href="/" className="shrink-0 text-[15px] font-black tracking-tight text-white">
            VIRAL <span className="italic text-[#FF1F8F]">HEIST</span>
          </Link>
          <nav className="flex min-w-0 flex-1 gap-4 overflow-x-auto text-sm font-medium whitespace-nowrap text-[#D4D4D2]">
            {[...links, CALENDAR_LINK].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "shrink-0 hover:text-[#FF1F8F]",
                  isActive(pathname, link.href) && "text-[#FF1F8F]",
                )}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/settings" className="shrink-0 hover:text-[#FF1F8F]">
              Settings
            </Link>
          </nav>
        </div>
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
            <Link href="/" className="flex items-center text-[22px] leading-none font-black tracking-tight text-white">
              {collapsed ? (
                <span className="text-[#FF1F8F] italic">V</span>
              ) : (
                <>
                  VIRAL
                  <span className="relative ml-0.5 rounded-[3px] bg-black px-1.5 py-0.5 text-[#FF1F8F] italic">
                    HEIST
                  </span>
                </>
              )}
            </Link>
          </div>

          <nav className="flex flex-col gap-0.5 px-2.5 text-sm font-medium">
            {links.map((link) => {
              const active = isActive(pathname, link.href);
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
            {(() => {
              const active = isActive(pathname, CALENDAR_LINK.href);
              return (
                <Link
                  href={CALENDAR_LINK.href}
                  title={collapsed ? CALENDAR_LINK.label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-[#D4D4D2] hover:text-[#FF1F8F]",
                    collapsed && "justify-center px-0",
                    active && "bg-[#FF1F8F] font-bold text-[#0D0D0D] hover:text-[#0D0D0D]",
                  )}
                >
                  <MaterialIcon name={CALENDAR_LINK.icon} size={19} />
                  {!collapsed && <span>{CALENDAR_LINK.label}</span>}
                </Link>
              );
            })()}
          </nav>

          <div className="mt-auto flex flex-col gap-5 px-3.5">
            {!collapsed && (
              <div className="ml-2 max-w-[120px] border-l-2 border-[#BDBDBB] bg-black px-2.5 py-2 text-sm leading-tight text-[#EDEDEB]">
                Turn ideas into a brand that moves.
              </div>
            )}
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
          </div>
        </div>
      </aside>
    </>
  );
}
