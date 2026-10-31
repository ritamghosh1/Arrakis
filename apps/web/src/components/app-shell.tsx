"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";
import { IconCompass, IconDune, IconPlus, IconTrophy, IconUser } from "./icons";

const NAV: { href: string; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { href: "/", label: "Home", Icon: IconDune },
  { href: "/explore", label: "Explore", Icon: IconCompass },
  { href: "/create", label: "Create", Icon: IconPlus },
  { href: "/ranks", label: "Ranks", Icon: IconTrophy },
  { href: "/u/ritam", label: "Me", Icon: IconUser },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href === "/u/ritam" ? "/u/" : href);
}

function Lockup() {
  return (
    <span className="font-display text-ink flex items-center gap-2 text-xl font-bold">
      <span className="bg-ink text-paper grid size-8 place-items-center rounded-lg">
        <IconDune className="size-5" />
      </span>
      Arrakis
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      {/* Desktop left rail */}
      <aside className="border-line bg-paper-raised hidden border-r lg:flex lg:flex-col lg:gap-8 lg:p-5">
        <Link href="/" aria-label="Arrakis home">
          <Lockup />
        </Link>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {NAV.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-medium",
                  active ? "bg-primary text-primary-ink" : "text-ink hover:bg-paper-sunken",
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            );
          })}
        </nav>
        <p className="text-ink-muted mt-auto text-xs text-pretty">
          Find tools by the problem they solve. Try them in one tap.
        </p>
      </aside>

      <div className="flex h-dvh min-h-0 flex-col lg:h-dvh">
        <main id="main" className="min-h-0 flex-1 overflow-hidden">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav
          aria-label="Primary"
          className="border-line bg-paper-raised pb-safe z-nav grid grid-cols-5 border-t lg:hidden"
        >
          {NAV.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                  active ? "text-primary" : "text-ink-muted",
                )}
              >
                <Icon className="size-6" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
