import type { DemoMode } from "@arrakis/contracts";
import Link from "next/link";
import { ExploreClient } from "@/components/explore-client";
import { IconSearch } from "@/components/icons";
import { CATEGORIES, fetchGlobalFeed } from "@/lib/data";
import { cn } from "@/lib/utils";

export const metadata = { title: "Explore · Arrakis" };
export const dynamic = "force-dynamic";

type SP = {
  q?: string;
  mode?: string;
  category?: string;
  verified?: string;
  sort?: string;
  focus?: string;
};

const MODE_LABELS: Record<DemoMode, string> = {
  container: "Container / CLI",
  api: "Interactive API",
  web: "Web App",
  handoff: "Desktop App",
};

const MODES = Object.keys(MODE_LABELS) as DemoMode[];

const SORTS = [
  ["trending", "Recommended"],
  ["new", "Newest"],
  ["tried", "Most Tested"],
] as const;

const TRENDING_PROBLEMS = ["resume", "csv", "env", "cron", "svg", "invoice"] as const;

function href(sp: SP, patch: Partial<SP>) {
  const next = { ...sp, ...patch, focus: undefined };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `/explore?${s}` : "/explore";
}

function Chip({
  active,
  to,
  children,
}: {
  active: boolean;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={to}
      aria-current={active ? "true" : undefined}
      className={cn(
        "shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-ink bg-ink text-dune shadow-sm"
          : "border-border bg-surface text-muted hover:text-ink"
      )}
    >
      {children}
    </Link>
  );
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const mode = MODES.includes(sp.mode as DemoMode) ? (sp.mode as DemoMode) : undefined;
  const verifiedOnly = sp.verified === "1";
  const feed = await fetchGlobalFeed({
    q: sp.q,
    mode,
    category: sp.category,
    verifiedOnly,
  });
  const items = [...feed.items];
  if (sp.sort === "new") items.sort((a, b) => b.post.createdAt.localeCompare(a.post.createdAt));
  if (sp.sort === "tried") items.sort((a, b) => b.post.stats.tries - a.post.stats.tries);
  const q = sp.q?.trim();

  return (
    <div className="mx-auto max-w-[1080px] px-4 sm:px-6 py-6 lg:py-9 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Explore Builds by Problem
          </h1>
          <p className="text-sm text-muted mt-0.5">
            Search working developer tools and projects by what they solve.
          </p>
        </div>
      </header>

      {/* Search Bar */}
      <form role="search" action="/explore" className="relative">
        <label htmlFor="q" className="sr-only">
          Describe the problem you want solved
        </label>
        <IconSearch className="text-muted pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" />
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          autoFocus={Boolean(sp.focus)}
          enterKeyHint="search"
          placeholder="Search by problem, e.g. 'convert PDF resume to JSON' or 'clean messy CSV'..."
          className="h-12 w-full rounded-2xl border border-border bg-surface pr-28 pl-12 text-sm text-ink shadow-sm focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          className="absolute top-1.5 right-1.5 h-9 rounded-xl bg-ink px-4 text-xs font-semibold text-dune hover:bg-ink/90 transition-colors"
        >
          Search
        </button>
        {mode && <input type="hidden" name="mode" value={mode} />}
        {sp.category && <input type="hidden" name="category" value={sp.category} />}
        {sp.verified && <input type="hidden" name="verified" value={sp.verified} />}
        {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
      </form>

      {/* Quick Topic Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted">Popular searches:</span>
        {TRENDING_PROBLEMS.map((tp) => (
          <Link
            key={tp}
            href={href(sp, { q: tp })}
            className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:border-ink/40 transition-colors"
          >
            {tp}
          </Link>
        ))}
        {q && (
          <Link href={href(sp, { q: undefined })} className="text-xs font-semibold text-accent hover:underline">
            Clear search
          </Link>
        )}
      </div>

      {/* Filters */}
      <nav
        aria-label="Filters"
        className="rounded-2xl border border-border bg-surface p-4 space-y-3 shadow-sm"
      >
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          <Chip active={!mode} to={href(sp, { mode: undefined })}>
            All Demo Types
          </Chip>
          {MODES.map((m) => (
            <Chip key={m} active={mode === m} to={href(sp, { mode: m })}>
              {MODE_LABELS[m]}
            </Chip>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          <Chip active={!sp.category} to={href(sp, { category: undefined })}>
            All Categories
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={sp.category === c} to={href(sp, { category: c })}>
              {c}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">Sort by:</span>
            {SORTS.map(([key, label]) => (
              <Chip
                key={key}
                active={(sp.sort ?? "trending") === key}
                to={href(sp, { sort: key })}
              >
                {label}
              </Chip>
            ))}
          </div>

          <Chip active={verifiedOnly} to={href(sp, { verified: verifiedOnly ? undefined : "1" })}>
            ✓ Verified Demos Only
          </Chip>
        </div>
      </nav>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center space-y-3">
          <p className="font-display text-lg font-bold text-ink">No matching builds found</p>
          <p className="text-sm text-muted">
            Try a broader search phrase or clear your active filters.
          </p>
          <Link
            href="/explore"
            className="inline-block rounded-xl bg-ink px-5 py-2.5 text-xs font-semibold text-dune"
          >
            Reset Filters
          </Link>
        </div>
      ) : (
        <ExploreClient items={items} />
      )}
    </div>
  );
}
