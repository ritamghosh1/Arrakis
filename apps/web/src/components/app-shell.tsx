"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CompassIcon,
  HomeIcon,
  PlusSquareIcon,
  SparklesIcon,
  TrophyIcon,
  UserIcon,
  VerifiedIcon,
} from "./icons";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Feed", sublabel: "Curated for you", icon: HomeIcon },
  { href: "/explore", label: "Explore", sublabel: "Search by problem", icon: CompassIcon },
  { href: "/create", label: "Publish", sublabel: "Share a build", icon: PlusSquareIcon },
  { href: "/ranks", label: "Standings", sublabel: "Builders & scouts", icon: TrophyIcon },
  { href: "/u/ritam", label: "Profile", sublabel: "@ritam", icon: UserIcon },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomeFeed = pathname === "/";

  return (
    <div className="min-h-dvh bg-dune text-ink flex flex-col lg:flex-row">
      {/* Desktop Left Rail (>= 1024px) */}
      <aside
        aria-label="Primary navigation"
        className="hidden lg:flex lg:w-[264px] lg:shrink-0 lg:flex-col lg:justify-between lg:bg-surface/90 lg:px-5 lg:py-6 lg:sticky lg:top-0 lg:h-dvh z-nav"
      >
        <div className="space-y-7">
          <Link
            href="/"
            className="flex items-center gap-3 px-2 py-1.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent group"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-ink text-dune font-display text-lg font-bold tracking-tight transition-transform group-hover:scale-[1.03]">
              A
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xl font-bold tracking-tight text-ink">
                  Arrakis
                </span>
                <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                  Beta
                </span>
              </div>
              <p className="text-xs text-muted">Discover & try real builds</p>
            </div>
          </Link>

          <nav className="space-y-1">
            {NAV_ITEMS.map(({ href, label, sublabel, icon: Icon }) => {
              const active =
                href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-ink text-dune font-semibold shadow-sm"
                      : "text-muted hover:bg-dune hover:text-ink font-medium"
                  )}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={cn(
                        "size-5 shrink-0 transition-colors",
                        active ? "text-accent-soft" : "text-muted group-hover:text-ink"
                      )}
                    />
                    <span className="truncate">
                      <span className="block leading-tight">{label}</span>
                      <span
                        className={cn(
                          "block text-[11px] font-normal truncate mt-0.5",
                          active ? "text-dune/70" : "text-muted/80"
                        )}
                      >
                        {sublabel}
                      </span>
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Clean Builder & Scout Identity Footer */}
        <div className="space-y-3">
          <Link
            href="/u/ritam"
            className="block rounded-xl border border-border bg-dune/70 p-3.5 hover:border-ink/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-full bg-ink text-dune flex items-center justify-center font-display text-xs font-bold shrink-0">
                RG
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-semibold text-ink truncate">Ritam Ghosh</p>
                  <VerifiedIcon className="size-3.5 text-sage shrink-0" />
                </div>
                <p className="text-[11px] text-muted truncate">@ritam · Builder & Scout</p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-border/80 flex items-center justify-between text-[11px] text-muted">
              <span className="inline-flex items-center gap-1 text-sage font-medium">
                <SparklesIcon className="size-3.5" />
                Verified Builder
              </span>
              <span className="font-medium text-ink">View Studio →</span>
            </div>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main
        id="main-content"
        className={cn(
          "flex-1 min-w-0",
          isHomeFeed
            ? "h-[calc(100dvh-3.75rem)] lg:h-dvh overflow-hidden flex flex-col"
            : "pb-20 lg:pb-0"
        )}
      >
        {children}
      </main>

      {/* Mobile Bottom Navigation (< 1024px) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed inset-x-0 bottom-0 z-nav flex items-center justify-around border-t border-border bg-surface/95 backdrop-blur-md px-2 py-1.5 pb-safe lg:hidden"
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-colors",
                active ? "text-accent font-semibold" : "text-muted hover:text-ink"
              )}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
