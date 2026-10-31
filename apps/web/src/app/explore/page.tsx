import Link from "next/link";
import type { DemoMode } from "@arrakis/contracts";
import { cn, compact } from "@/lib/utils";
import { CATEGORIES, fetchGlobalFeed } from "@/lib/data";
import { MODE_LABEL } from "@/components/reel-card";
import { ReasonChip } from "@/components/reason-chip";
import { IconSearch } from "@/components/icons";

export const metadata = { title: "Explore" };
export const dynamic = "force-dynamic";

type SP = { q?: string; mode?: string; category?: string; sort?: string; focus?: string };

const MODES = Object.keys(MODE_LABEL) as DemoMode[];
const SORTS = [
  ["trending", "Trending"],
  ["new", "New"],
  ["tried", "Most tried"],
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
        "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
        active ? "border-ink bg-ink text-paper" : "border-line bg-paper-raised text-ink",
      )}
    >
      {children}
    </Link>
  );
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const mode = MODES.includes(sp.mode as DemoMode) ? (sp.mode as DemoMode) : undefined;
  const feed = await fetchGlobalFeed({ q: sp.q, mode, category: sp.category });
  let items = [...feed.items];
  if (sp.sort === "new") items.sort((a, b) => b.post.createdAt.localeCompare(a.post.createdAt));
  if (sp.sort === "tried") items.sort((a, b) => b.post.stats.tries - a.post.stats.tries);
  const q = sp.q?.trim();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-8">
        <h1 className="font-display text-2xl font-bold">Explore</h1>

        <form role="search" action="/explore" className="relative">
          <label htmlFor="q" className="sr-only">
            Describe the problem you want solved
          </label>
          <IconSearch className="text-ink-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2" />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            autoFocus={Boolean(sp.focus)}
            enterKeyHint="search"
            placeholder="Describe a problem, e.g. “clean a messy CSV”"
            className="border-line bg-paper-raised h-12 w-full rounded-full border pr-4 pl-11 text-[15px]"
          />
          {mode && <input type="hidden" name="mode" value={mode} />}
          {sp.category && <input type="hidden" name="category" value={sp.category} />}
          {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
        </form>

        <nav aria-label="Filters" className="flex flex-col gap-2">
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
            <Chip active={!mode} to={href(sp, { mode: undefined })}>
              Any type
            </Chip>
            {MODES.map((m) => (
              <Chip key={m} active={mode === m} to={href(sp, { mode: m })}>
                {MODE_LABEL[m]}
              </Chip>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
            <Chip active={!sp.category} to={href(sp, { category: undefined })}>
              All topics
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c} active={sp.category === c} to={href(sp, { category: c })}>
                {c}
              </Chip>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-ink-muted text-sm">Sort</span>
            {SORTS.map(([key, label]) => (
              <Chip key={key} active={(sp.sort ?? "trending") === key} to={href(sp, { sort: key })}>
                {label}
              </Chip>
            ))}
          </div>
        </nav>

        <p className="text-ink-muted text-sm tabular-nums" role="status">
          {q ? `${items.length} tools for “${q}”` : `${items.length} tools`}
        </p>

        {items.length === 0 ? (
          <div className="border-line rounded-[var(--radius-card)] border border-dashed p-8 text-center">
            <p className="font-display text-lg font-bold text-balance">Nothing solves that yet</p>
            <p className="text-ink-muted mt-1 text-sm text-pretty">Try fewer words or clear the filters.</p>
            <Link href="/explore" className="bg-primary text-primary-ink mt-4 inline-block rounded-full px-5 py-2.5 font-semibold">
              Clear filters
            </Link>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map(({ post, reason }) => (
              <li key={post.id} className="border-line bg-paper-raised flex flex-col gap-3 rounded-[var(--radius-card)] border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted text-xs font-medium">{MODE_LABEL[post.demo.mode]}</span>
                  <span className="text-sage text-xs font-semibold tabular-nums">{post.health.uptimePct}% uptime</span>
                </div>
                <Link href={`/p/${post.id}`} className="block">
                  <h2 className="font-display text-base leading-5 font-bold text-balance">{post.title}</h2>
                  <p className="text-ink-muted mt-1 line-clamp-3 text-sm text-pretty">{post.problemStatement}</p>
                </Link>
                <ReasonChip reason={reason} className="bg-paper-sunken max-w-full shadow-none" />
                <div className="text-ink-muted mt-auto flex items-center justify-between text-xs tabular-nums">
                  <Link href={`/u/${post.author.handle}`} className="text-ink font-medium">
                    @{post.author.handle}
                  </Link>
                  <span>{compact(post.stats.tries)} tries</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
