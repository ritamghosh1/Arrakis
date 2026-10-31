"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FeedItem } from "@arrakis/contracts";
import { cn, compact } from "@/lib/utils";
import { track } from "@/lib/events";
import { ReasonChip } from "./reason-chip";
import { IconArrowUp, IconBolt, IconBookmark, IconChat, IconCheck, IconShare } from "./icons";

export const MODE_LABEL = {
  container: "Container Sandbox",
  api: "Live API Proxy",
  web: "Web Sandbox",
  handoff: "Desktop Handoff",
} as const;

type Props = {
  item: FeedItem;
  active: boolean;
  upvoted: boolean;
  tried: boolean;
  saved: boolean;
  following: boolean;
  onUpvote: () => void;
  onSave: () => void;
  onFollow: () => void;
  onTry: () => void;
  onShare: () => void;
};

function ActionButton({
  label,
  count,
  badge,
  pressed,
  onClick,
  href,
  children,
}: {
  label: string;
  count?: number;
  badge?: string;
  pressed?: boolean;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
}) {
  const cls = cn(
    "border-paper/20 bg-ink/85 text-paper relative grid size-11 place-items-center rounded-full border shadow-sm transition-transform active:scale-95",
    pressed && "border-primary bg-paper-raised text-primary",
  );
  return (
    <div className="flex flex-col items-center gap-1">
      {href ? (
        <Link href={href} aria-label={label} className={cls}>
          {children}
        </Link>
      ) : (
        <button type="button" aria-label={label} aria-pressed={pressed} onClick={onClick} className={cls}>
          {children}
          {badge && (
            <span className="bg-sage text-primary-ink absolute -top-1.5 -right-1.5 rounded-full px-1.5 py-0.2 font-mono text-[9px] font-bold">
              {badge}
            </span>
          )}
        </button>
      )}
      {count !== undefined && (
        <span className="bg-ink/85 text-paper rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums">
          {compact(count)}
        </span>
      )}
    </div>
  );
}

export function ReelCard({
  item,
  active,
  upvoted,
  tried,
  saved,
  following,
  onUpvote,
  onSave,
  onFollow,
  onTry,
  onShare,
}: Props) {
  const { post, reason } = item;
  const ref = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const activeSince = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(Boolean(e?.isIntersecting)), {
      rootMargin: "100% 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (active) {
      activeSince.current = performance.now();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (v && !reduce) void v.play().catch(() => undefined);
    } else {
      v?.pause();
      if (activeSince.current !== null) {
        const sec = (performance.now() - activeSince.current) / 1000;
        activeSince.current = null;
        if (sec >= 1) track("view", post.id, Number(sec.toFixed(1)));
      }
    }
  }, [active, post.id]);

  useEffect(() => {
    if (!near && videoRef.current) {
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }, [near]);

  return (
    <article
      ref={ref}
      aria-label={post.title}
      className="feed-item h-full p-2 sm:py-3"
      data-post-id={post.id}
    >
      <div className="border-line bg-ink relative mx-auto h-full max-w-[27.5rem] overflow-hidden rounded-[var(--radius-card)] border shadow-md">
        {/* Media */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.thumbUrl}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-90"
          loading={active ? "eager" : "lazy"}
          decoding="async"
        />
        {!videoFailed && (
          <video
            ref={videoRef}
            className="absolute inset-0 size-full object-cover opacity-90"
            src={near ? post.videoUrl : undefined}
            poster={post.thumbUrl}
            muted
            loop
            playsInline
            preload="none"
            aria-label={`Demo reel: ${post.title}`}
            onError={() => setVideoFailed(true)}
          />
        )}

        {/* Top: Reason attribution chip + Mode & Live Telemetry */}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <ReasonChip reason={reason} />
          <div className="flex flex-col items-end gap-1">
            <span className="border-paper/20 bg-ink/85 text-paper rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold whitespace-nowrap">
              {MODE_LABEL[post.demo.mode]}
            </span>
            <span className="bg-ink/85 text-paper flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] tabular-nums">
              <span className="bg-sage size-1.5 rounded-full" />
              {post.health.uptimePct}% · {post.health.p50LatencyMs}ms
            </span>
            <span
              className="border-paper/20 bg-ink/85 text-paper flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums"
              title="Bayesian Usability Score (S_use) and Popularity Score (S_pop)"
            >
              <span className="text-sage">Use {(post.usabilityScore ?? 1.45).toFixed(2)}</span>
              <span className="text-paper/45">·</span>
              <span>Pop {Math.round(post.popularityScore ?? post.postScore)}</span>
            </span>
          </div>
        </div>

        {/* Right: Action rail */}
        <div className="absolute right-3 bottom-44 flex flex-col items-center gap-3">
          <ActionButton
            label={
              upvoted
                ? tried
                  ? "Remove 3x Proof-of-Trial upvote"
                  : "Remove upvote"
                : tried
                  ? "Upvote with 3x Proof-of-Trial weight"
                  : "Upvote"
            }
            count={post.stats.upvotes + (upvoted ? (tried ? 3 : 1) : 0)}
            badge={tried ? "3×" : undefined}
            pressed={upvoted}
            onClick={onUpvote}
          >
            <IconArrowUp className="size-5" />
          </ActionButton>
          <ActionButton
            label="Reviews and comments"
            count={post.stats.comments}
            href={`/p/${post.id}#comments`}
          >
            <IconChat className="size-5" />
          </ActionButton>
          <ActionButton label={saved ? "Unsave" : "Save"} pressed={saved} onClick={onSave}>
            <IconBookmark className="size-5" />
          </ActionButton>
          <ActionButton label="Share tool" onClick={onShare}>
            <IconShare className="size-5" />
          </ActionButton>
        </div>

        {/* Bottom: Author, Problem-Statement Card, and 1-Tap Try It Dock */}
        <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2.5 pr-14">
          <div className="flex items-center gap-2">
            <Link
              href={`/u/${post.author.handle}`}
              className="bg-ink/85 border-paper/15 flex min-w-0 items-center gap-2 rounded-full border py-1 pr-3 pl-1"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.author.avatarUrl}
                alt=""
                className="bg-paper size-7 shrink-0 rounded-full"
                width={28}
                height={28}
              />
              <span className="text-paper truncate text-xs font-bold">@{post.author.handle}</span>
              {post.health.verifiedUtility && (
                <span
                  className="bg-sage text-primary-ink grid size-4 shrink-0 place-items-center rounded-full"
                  title="Verified Utility: over 85% live demo uptime"
                >
                  <IconCheck className="size-2.5" strokeWidth={3} />
                  <span className="sr-only">Verified Utility</span>
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={onFollow}
              aria-pressed={following}
              className={cn(
                "ml-auto shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition-transform active:scale-95",
                following
                  ? "border-paper/60 bg-ink/80 text-paper"
                  : "border-paper bg-paper text-ink",
              )}
            >
              {following ? "Following" : "+ Follow"}
              <span className="sr-only"> @{post.author.handle}</span>
            </button>
          </div>

          <div className="border-paper/15 bg-ink/90 text-paper rounded-2xl border p-3.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-paper/70 font-mono text-[10px] font-semibold uppercase">
                {post.category}
              </span>
              <Link
                href={`/p/${post.id}`}
                className="text-paper/75 font-mono text-[10px] font-semibold underline"
              >
                Full telemetry ↗
              </Link>
            </div>
            <h2 className="font-display mt-0.5 text-[17px] leading-5 font-bold text-balance">
              {post.title}
            </h2>
            <p
              className={cn(
                "text-paper/90 mt-1 text-[13px] leading-[18px] text-pretty",
                !expanded && "line-clamp-2",
              )}
            >
              <span className="text-paper font-semibold">Problem solved: </span>
              {post.problemStatement}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex flex-wrap gap-1">
                {post.tags.slice(0, 3).map((tag) => (
                  <Link
                    key={tag}
                    href={`/explore?q=${encodeURIComponent(tag)}`}
                    className="bg-paper/15 text-paper/90 rounded-md px-1.5 py-0.5 font-mono text-[10px]"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="text-paper/80 text-[11px] font-semibold underline"
              >
                {expanded ? "Less" : "More"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onTry}
              className="bg-primary text-primary-ink flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-bold shadow-md transition-transform active:scale-[0.98]"
            >
              <IconBolt className="size-5" />
              <span>Try it in 1 Tap</span>
              {tried && (
                <span className="bg-primary-ink/20 rounded-full px-2 py-0.5 font-mono text-[10px]">
                  Verified ✓
                </span>
              )}
            </button>
            <div className="bg-ink/85 border-paper/15 text-paper rounded-2xl border px-3 py-1.5 font-mono text-[11px] leading-4 tabular-nums">
              <span className="block font-bold">{compact(post.stats.tries)} tries</span>
              <span className="text-paper/75 block text-[10px]">
                {post.stats.trialUpvotes} 3× votes
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
