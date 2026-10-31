"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedItem } from "@arrakis/contracts";
import { cn, compact } from "@/lib/utils";
import { track } from "@/lib/events";
import { ReasonChip } from "./reason-chip";
import { IconArrowUp, IconBolt, IconBookmark, IconChat, IconCheck, IconShare } from "./icons";
import Link from "next/link";

export const MODE_LABEL = {
  container: "Container sandbox",
  api: "Live API",
  web: "Web app",
  handoff: "Desktop handoff",
} as const;

type Props = {
  item: FeedItem;
  active: boolean;
  upvoted: boolean;
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
  pressed,
  onClick,
  href,
  children,
}: {
  label: string;
  count?: number;
  pressed?: boolean;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
}) {
  const cls = cn(
    "bg-ink/80 text-paper grid size-11 place-items-center rounded-full transition-transform active:scale-95",
    pressed && "bg-paper-raised text-primary",
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
        </button>
      )}
      {count !== undefined && (
        <span className="bg-ink/80 text-paper rounded-full px-1.5 text-[11px] font-medium tabular-nums">
          {compact(count)}
        </span>
      )}
    </div>
  );
}

export function ReelCard({ item, active, upvoted, saved, following, onUpvote, onSave, onFollow, onTry, onShare }: Props) {
  const { post, reason } = item;
  const ref = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const activeSince = useRef<number | null>(null);

  // Only attach the video source when the card is close to the viewport (lazy-load-video-and-audio guide).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(Boolean(e?.isIntersecting)), {
      rootMargin: "100% 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Play only the active card, pause everything else, and record dwell time as a `view` event.
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

  // Release decoded media when far away.
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
      className="feed-item h-full p-2"
      data-post-id={post.id}
    >
      <div className="bg-ink relative mx-auto h-full max-w-[26rem] overflow-hidden rounded-[var(--radius-card)]">
        {/* Media */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.thumbUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
          loading={active ? "eager" : "lazy"}
          decoding="async"
        />
        {!videoFailed && (
          <video
            ref={videoRef}
            className="absolute inset-0 size-full object-cover"
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

        {/* Top: reason attribution + mode */}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <ReasonChip reason={reason} />
          <span className="bg-ink/80 text-paper rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap">
            {MODE_LABEL[post.demo.mode]}
          </span>
        </div>

        {/* Right: action rail */}
        <div className="absolute right-3 bottom-40 flex flex-col items-center gap-3">
          <ActionButton
            label={upvoted ? "Remove upvote" : "Upvote"}
            count={post.stats.upvotes + (upvoted ? 1 : 0)}
            pressed={upvoted}
            onClick={onUpvote}
          >
            <IconArrowUp className="size-6" />
          </ActionButton>
          <ActionButton label="Comments" count={post.stats.comments} href={`/p/${post.id}#comments`}>
            <IconChat className="size-6" />
          </ActionButton>
          <ActionButton label={saved ? "Unsave" : "Save"} pressed={saved} onClick={onSave}>
            <IconBookmark className="size-6" />
          </ActionButton>
          <ActionButton label="Share" onClick={onShare}>
            <IconShare className="size-6" />
          </ActionButton>
        </div>

        {/* Bottom: author, problem card, Try it dock */}
        <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2.5 pr-14">
          <div className="flex items-center gap-2">
            <Link href={`/u/${post.author.handle}`} className="flex min-w-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.author.avatarUrl}
                alt=""
                className="bg-paper size-8 shrink-0 rounded-full"
                width={32}
                height={32}
              />
              <span className="text-paper truncate text-sm font-semibold">@{post.author.handle}</span>
              {post.health.verifiedUtility && (
                <span
                  className="bg-sage text-primary-ink grid size-4 shrink-0 place-items-center rounded-full"
                  title="Verified Utility: over 85% live demo uptime"
                >
                  <IconCheck className="size-3" strokeWidth={3} />
                  <span className="sr-only">Verified Utility</span>
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={onFollow}
              aria-pressed={following}
              className={cn(
                "ml-auto shrink-0 rounded-full border px-3 py-1 text-xs font-semibold",
                following
                  ? "border-paper/60 text-paper"
                  : "border-paper bg-paper text-ink",
              )}
            >
              {following ? "Following" : "Follow"}
              <span className="sr-only"> @{post.author.handle}</span>
            </button>
          </div>

          <div className="bg-ink/80 text-paper rounded-2xl p-3">
            <h2 className="font-display text-[17px] leading-5 font-bold text-balance">{post.title}</h2>
            <p
              className={cn("text-paper/90 mt-1 text-[13px] leading-[18px] text-pretty", !expanded && "line-clamp-2")}
            >
              <span className="text-paper font-semibold">Solves: </span>
              {post.problemStatement}
            </p>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="text-paper/80 mt-0.5 text-xs underline"
            >
              {expanded ? "Show less" : "More"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onTry}
              className="bg-primary text-primary-ink flex h-12 flex-1 items-center justify-center gap-2 rounded-full text-base font-bold transition-transform active:scale-[0.98]"
            >
              <IconBolt className="size-5" />
              Try it
            </button>
            <p className="text-paper text-[11px] leading-4 tabular-nums">
              <span className="block font-semibold">{compact(post.stats.tries)} tries</span>
              <span className="block">{post.health.uptimePct}% uptime</span>
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
