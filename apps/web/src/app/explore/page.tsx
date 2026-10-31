import Link from "next/link";
import type { DemoMode } from "@arrakis/contracts";
import { cn } from "@/lib/utils";
import { CATEGORIES, fetchGlobalFeed } from "@/lib/data";
import { MODE_LABEL } from "@/components/reel-card";
import { ExploreClient } from "@/components/explore-client";
import { IconSearch } from "@/components/icons";

export const metadata = { title: "Explore · Problem-First Search" };
export const dynamic = "force-dynamic";

type SP = {
  q?: string;
  mode?: string;
  category?: string;
  verified?: string;
  sort?: string;
  focus?: string;
};

const MODES = Object.keys(MODE_LABEL) as DemoMode[];
const SORTS = [
  ["trending", "Proof-of-Trial"],
  ["new", "Newest"],
  ["tried", "Most Tried"],
] as const;

const TRENDING_PROBLEMS = [
  "resume",
  "csv",
  "env",
  "cron",
  "svg",
  "invoice",
] as const;

function href(sp: SP, patch: Partial<SP>) {
  const next = { ...sp, ...patch, focus: undefined };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `/explore?${s}` : "/explore";
}

function Chip({ active, to, children }: { active: boolean; to: string; children: React.ReactNode }) {
  return (
    <Link
      href={to}
      aria-current={active ? "true" : undefined}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
        active ? "border-ink bg-ink text-paper" : "border-line bg-paper-raised text-ink hover:bg-paper-sunken",
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
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 pt-5 pb-12">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-ink-muted font-mono text-xs font-semibold uppercase">
              Hybrid BM25 + pgvector Requirement Search
            </p>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">
              Explore by Problem Solved
            </h1>
          </div>
          <span className="text-ink-muted font-mono text-xs tabular-nums" role="status">
            {q ? `${items.length} tools matching “${q}”` : `${items.length} indexed tools`}
          </span>
        </header>

        {/* Search Bar */}
        <form role="search" action="/explore" className="relative">
          <label htmlFor="q" className="sr-only">
            Describe the problem you want solved
          </label>
          <IconSearch className="text-ink-muted pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            autoFocus={Boolean(sp.focus)}
            enterKeyHint="search"
            placeholder="Describe a requirement, e.g. “convert PDF resume to JSON” or “clean messy CSV”…"
            className="border-line bg-paper-raised h-12 w-full rounded-full border pr-24 pl-12 text-sm font-medium shadow-2xs"
          />
          <button
            type="submit"
            className="bg-ink text-paper absolute top-1.5 right-1.5 h-9 rounded-full px-4 text-xs font-bold"
          >
            Search
          </button>
          {mode && <input type="hidden" name="mode" value={mode} />}
          {sp.category && <input type="hidden" name="category" value={sp.category} />}
          {sp.verified && <input type="hidden" name="verified" value={sp.verified} />}
          {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
        </form>

        {/* Trending problem quick-chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-ink-muted font-mono text-[11px] font-semibold">
            Trending queries:
          </span>
          {TRENDING_PROBLEMS.map((tp) => (
            <Link
              key={tp}
              href={href(sp, { q: tp })}
              className="border-line bg-paper hover:bg-paper-sunken rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium"
            >
              “{tp}”
            </Link>
          ))}
          {q && (
            <Link
              href={href(sp, { q: undefined })}
              className="text-primary font-mono text-[11px] font-bold underline"
            >
              Clear query
            </Link>
          )}
        </div>

        {/* Filters */}
        <nav aria-label="Filters" className="border-line bg-paper-raised flex flex-col gap-2.5 rounded-2xl border p-3">
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            <Chip active={!mode} to={href(sp, { mode: undefined })}>
              All Demo Modes
            </Chip>
            {MODES.map((m) => (
              <Chip key={m} active={mode === m} to={href(sp, { mode: m })}>
                {MODE_LABEL[m]}
              </Chip>
            ))}
          </div>

          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            <Chip active={!sp.category} to={href(sp, { category: undefined })}>
              All Categories
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c} active={sp.category === c} to={href(sp, { category: c })}>
                {c}
              </Chip>
            ))}
          </div>

          <div className="border-line flex flex-wrap items-center justify-between gap-2 border-t pt-2">
            <div className="flex items-center gap-1.5">
              <span className="text-ink-muted font-mono text-xs">Sort:</span>
              {SORTS.map(([key, label]) => (
                <Chip key={key} active={(sp.sort ?? "trending") === key} to={href(sp, { sort: key })}>
                  {label}
                </Chip>
              ))}
            </div>

            <Chip
              active={verifiedOnly}
              to={href(sp, { verified: verifiedOnly ? undefined : "1" })}
            >
              ✓ Verified Utility Only (&gt;85% Uptime)
            </Chip>
          </div>
        </nav>

        {items.length === 0 ? (
          <div className="border-line bg-paper-raised rounded-[var(--radius-card)] border border-dashed p-8 text-center">
            <p className="font-display text-lg font-bold text-balance">
              No tools match that combination yet
            </p>
            <p className="text-ink-muted mt-1 text-sm text-pretty">
              Try a broader problem phrase or reset active filters.
            </p>
            <Link
              href="/explore"
              className="bg-primary text-primary-ink mt-4 inline-block rounded-full px-5 py-2.5 text-xs font-bold"
            >
              Reset all filters
            </Link>
          </div>
        ) : (
          <ExploreClient items={items} />
        )}
      </div>
    </div>
  );
}
