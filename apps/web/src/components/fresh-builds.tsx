import Link from "next/link";
import type { Post } from "@arrakis/contracts";

/** Fresh Builds: zero-follower builders get a guaranteed spotlight; ring shows live demo uptime. */
export function FreshBuilds({ posts }: { posts: Post[] }) {
  if (posts.length === 0) return null;
  return (
    <section aria-label="Fresh builds" className="min-w-0">
      <ul className="flex gap-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
        {posts.map((p) => {
          const healthy = p.health.uptimePct >= 85;
          return (
            <li key={p.id} className="shrink-0">
              <Link
                href={`/p/${p.id}`}
                className="flex w-[4.5rem] flex-col items-center gap-1"
                aria-label={`${p.title} by @${p.author.handle}, ${p.health.uptimePct}% uptime`}
              >
                <span
                  className={`grid size-14 place-items-center rounded-full border-2 ${
                    healthy ? "border-sage" : "border-line"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.author.avatarUrl} alt={p.author.displayName} width={48} height={48} className="bg-paper-sunken size-12 rounded-full" />
                </span>
                <span className="text-ink w-full truncate text-center text-[11px] font-medium">@{p.author.handle}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
