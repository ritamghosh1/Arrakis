"use client";

import type { FeedItem, Post } from "@arrakis/contracts";
import Link from "next/link";
import { useState } from "react";
import { ShareIcon, TerminalIcon, VerifiedIcon } from "./icons";
import { ShareSheet } from "./share-sheet";
import { TrySheet } from "./try-sheet";

export function ExploreClient({ items }: { items: FeedItem[] }) {
  const [activeTryPost, setActiveTryPost] = useState<Post | null>(null);
  const [activeSharePost, setActiveSharePost] = useState<Post | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {items.map(({ post }) => (
          <article
            key={post.id}
            className="cv-auto rounded-2xl border border-border bg-surface overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
          >
            <div>
              <Link href={`/p/${post.id}`} className="block relative aspect-[16/9] bg-ink">
                <img
                  src={post.thumbUrl}
                  alt={post.title}
                  className="h-full w-full object-cover opacity-90 hover:opacity-100 transition-opacity"
                />
                <span className="absolute top-3 left-3 rounded-lg bg-ink/85 px-2.5 py-1 text-[11px] font-semibold text-dune">
                  {post.category}
                </span>
                {post.health.verifiedUtility && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-lg bg-sage-soft px-2 py-0.5 text-[11px] font-semibold text-sage">
                    <span className="size-1.5 rounded-full bg-sage" />
                    Verified
                  </span>
                )}
              </Link>

              <div className="p-4 sm:p-5 space-y-3">
                <div className="rounded-xl border border-border bg-dune/70 p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-accent mb-0.5">
                    Problem Solved
                  </span>
                  <p className="text-xs font-medium text-ink line-clamp-2 leading-relaxed">
                    {post.problemStatement}
                  </p>
                </div>

                <div>
                  <Link
                    href={`/p/${post.id}`}
                    className="block font-display text-base font-bold text-ink hover:text-accent transition-colors line-clamp-1"
                  >
                    {post.title}
                  </Link>
                  <Link
                    href={`/u/${post.author.handle}`}
                    className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
                  >
                    <span>by @{post.author.handle}</span>
                    {post.author.verifiedUtility && (
                      <VerifiedIcon className="size-3.5 text-sage shrink-0" />
                    )}
                  </Link>
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-5 pb-4 pt-3 border-t border-border flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTryPost(post)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-white hover:bg-accent-hover transition-colors"
              >
                <TerminalIcon className="size-3.5" />
                <span>Try Live Demo</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSharePost(post)}
                aria-label={`Share ${post.title}`}
                className="inline-flex items-center justify-center rounded-xl border border-border bg-dune px-3 py-2 text-xs font-semibold text-ink hover:bg-border/50 transition-colors"
              >
                <ShareIcon className="size-3.5" />
              </button>
            </div>
          </article>
        ))}
      </div>

      <TrySheet post={activeTryPost} onClose={() => setActiveTryPost(null)} />
      <ShareSheet post={activeSharePost} onClose={() => setActiveSharePost(null)} />
    </>
  );
}
