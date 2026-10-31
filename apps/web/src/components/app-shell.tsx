"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";
import { IconBolt, IconCompass, IconDune, IconPlus, IconTrophy, IconUser } from "./icons";

const NAV: {
  href: string;
  label: string;
  sublabel: string;
  shortcut: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { href: "/", label: "Home Feed", sublabel: "80/20 Utility Reels", shortcut: "1", Icon: IconDune },
  { href: "/explore", label: "Explore", sublabel: "Problem Search", shortcut: "/", Icon: IconCompass },
  { href: "/create", label: "Publish Tool", sublabel: "Zero-Code Sandbox", shortcut: "C", Icon: IconPlus },
  { href: "/ranks", label: "Leaderboard", sublabel: "Proof-of-Trial", shortcut: "R", Icon: IconTrophy },
  { href: "/u/ritam", label: "Profile", sublabel: "@ritam · Studio", shortcut: "M", Icon: IconUser },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href === "/u/ritam" ? "/u/" : href);
}

function Lockup() {
  return (
    <div className="flex items-center gap-3">
      <span className="bg-ink text-paper relative grid size-10 place-items-center rounded-xl shadow-xs">
        <IconDune className="size-5" />
        <span className="bg-primary absolute top-1.5 right-1.5 size-2 rounded-full" />
      </span>
      <div className="flex flex-col">
        <span className="font-display text-ink text-xl leading-none font-bold">Arrakis</span>
        <span className="text-ink-muted mt-0.5 font-mono text-[10px] font-medium uppercase">
          Utility Social Feed
        </span>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="h-dvh lg:grid lg:grid-cols-[16.5rem_1fr]">
      {/* Desktop left rail */}
      <aside className="border-line bg-paper-raised hidden border-r lg:flex lg:flex-col lg:justify-between lg:p-5">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Link href="/" aria-label="Arrakis home" className="rounded-lg">
              <Lockup />
            </Link>
          </div>

          <nav aria-label="Primary" className="flex flex-col gap-1.5">
            {NAV.map(({ href, label, sublabel, shortcut, Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 transition-colors",
                    active
                      ? "bg-primary text-primary-ink shadow-xs"
                      : "text-ink hover:bg-paper-sunken",
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{label}</span>
                    <span
                      className={cn(
                        "block truncate text-[11px]",
                        active ? "text-primary-ink/85" : "text-ink-muted",
                      )}
                    >
                      {sublabel}
                    </span>
                  </div>
                  <kbd
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                      active
                        ? "border-primary-ink/30 bg-primary-ink/15 text-primary-ink"
                        : "border-line bg-paper text-ink-muted",
                    )}
                  >
                    {shortcut}
                  </kbd>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom persona & keyboard telemetry card */}
        <div className="flex flex-col gap-3">
          <Link
            href="/u/ritam"
            className="border-line bg-paper hover:bg-paper-sunken flex flex-col gap-2.5 rounded-2xl border p-3.5 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://api.dicebear.com/9.x/shapes/svg?seed=ritam"
                alt=""
                width={36}
                height={36}
                className="border-sage size-9 rounded-full border-2"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">Ritam Ghosh</p>
                <p className="text-ink-muted truncate font-mono text-[11px]">@ritam · Builder & Scout</p>
              </div>
            </div>
            <div className="border-line grid grid-cols-3 gap-1 border-t pt-2 text-center font-mono text-[11px] tabular-nums">
              <div>
                <span className="text-ink-muted block text-[10px]">XP</span>
                <span className="font-bold">1,480</span>
              </div>
              <div>
                <span className="text-ink-muted block text-[10px]">Rank</span>
                <span className="text-sage font-bold">#1</span>
              </div>
              <div>
                <span className="text-ink-muted block text-[10px]">Vote Wt</span>
                <span className="font-bold">3× Trial</span>
              </div>
            </div>
          </Link>

          <div className="border-line bg-paper-sunken/70 rounded-xl border px-3 py-2 text-[11px]">
            <p className="text-ink flex items-center gap-1.5 font-semibold">
              <IconBolt className="size-3.5" />
              Feed Shortcuts
            </p>
            <div className="text-ink-muted mt-1.5 grid grid-cols-2 gap-y-1 font-mono text-[10px]">
              <span>
                <kbd className="kbd-key">j</kbd> / <kbd className="kbd-key">k</kbd> Reel
              </span>
              <span>
                <kbd className="kbd-key">t</kbd> Try it
              </span>
              <span>
                <kbd className="kbd-key">u</kbd> Upvote
              </span>
              <span>
                <kbd className="kbd-key">/</kbd> Search
              </span>
            </div>
          </div>
        </div>
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
            const shortLabel = label.split(" ")[0];
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold",
                  active ? "text-primary" : "text-ink-muted",
                )}
              >
                {active && <span className="bg-primary absolute top-0 h-0.5 w-8 rounded-full" />}
                <Icon className="size-5" />
                <span>{shortLabel}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
