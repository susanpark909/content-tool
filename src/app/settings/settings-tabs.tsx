"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [{ href: "/settings/brand", label: "Brand Profile" }];

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 border-b px-4 sm:px-8">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 border-transparent py-3 text-sm text-muted-foreground hover:text-foreground",
              active && "border-foreground font-medium text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
