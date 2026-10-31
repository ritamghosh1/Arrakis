"use client";

import { useState } from "react";
import Link from "next/link";
import type { FeedItem, Post } from "@arrakis/contracts";
import { compact } from "@/lib/utils";
import { MODE_LABEL } from "./reel-card";
import { ReasonChip } from "./reason-chip";
import { ShareSheet } from "./share-sheet";
import { TrySheet } from "./try-sheet";
import { IconBolt, IconCheck, IconShare } from "./icons";

export function ExploreClient({ items }: { items: FeedItem[] }) {
  const [tryPost, setTryPost] = useState<Post | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);

  return (
    <>
      <ul className="grid gap-3.5 sm:grid-cols-2">
        {items.map(({ post, reason }) => (
          <li
            key={post.id}
            className="cv-auto border-line bg-paper-raised flex flex-col justify-between gap-3 rounded-[var(--radius-card)] border p-4 shadow-2xs"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="bg-paper-sunken text-ink rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold">
                  {MODE_LABEL[post.demo.mode]}
                </span>
                <span className="text-sage flex items-center gap-1 font-mono text-xs font-bold tabular-nums">
                  <span className="bg-sage size-2 rounded-full" />
                  {post.health.uptimePct}% · {post.health.p50LatencyMs}ms
                </span>
              </div>

              <Link href={`/p/${post.id}`} className="block">
                <h2 className="font-display text-base leading-5 font-bold text-balance hover:underline">
                  {post.title}
                </h2>
              </Link>
              <p className="text-ink-muted line-clamp-3 text-xs leading-relaxed text-pretty">
                <strong className="text-ink">Solves:</strong> {post.problemStatement}
              </p>

              <ReasonChip reason={reason} className="bg-paper-sunken max-w-full shadow-none" />
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="text-ink-muted flex items-center justify-between font-mono text-xs tabular-nums">
                <Link
                  href={`/u/${post.author.handle}`}
                  className="text-ink flex items-center gap-1 font-bold hover:underline"
                >
                  @{post.author.handle}
                  {post.health.verifiedUtility && (
                    <span
                      className="bg-sage text-primary-ink grid size-3.5 place-items-center rounded-full"
                      title="Verified Utility"
                    >
                      <IconCheck className="size-2.5" strokeWidth={3} />
                    </span>
                  )}
                </Link>
                <span>
                  {compact(post.stats.tries)} tries · {post.stats.trialUpvotes} 3× votes
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTryPost(post)}
                  className="bg-primary text-primary-ink flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-bold"
                >
                  <IconBolt className="size-3.5" />
                  Try in 1 Tap
                </button>
                <button
                  type="button"
                  onClick={() => setSharePost(post)}
                  aria-label={`Share ${post.title}`}
                  className="border-line bg-paper hover:bg-paper-sunken grid size-9 place-items-center rounded-full border"
                >
                  <IconShare className="size-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <TrySheet post={tryPost} onClose={() => setTryPost(null)} />
      <ShareSheet post={sharePost} onClose={() => setSharePost(null)} />
    </>
  );
}
