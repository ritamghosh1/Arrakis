"use client";

import type { FeedItem } from "@arrakis/contracts";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpIcon,
  BookmarkIcon,
  MessageIcon,
  PlayIcon,
  ShareIcon,
  TerminalIcon,
  VerifiedIcon,
} from "./icons";
import { ReasonChip } from "./reason-chip";
import { queueEvent } from "@/lib/events";
import { cn, compact, getYouTubeEmbedUrl } from "@/lib/utils";

interface ReelCardProps {
  item: FeedItem;
  isActive: boolean;
  onTry: (item: FeedItem) => void;
  onShare: (item: FeedItem) => void;
}

export const MODE_LABEL: Record<string, string> = {
  container: "Live Container",
  api: "Interactive API",
  web: "Web App",
  handoff: "Desktop App",
};

const MODE_LABELS = MODE_LABEL;

export function ReelCard({ item, isActive, onTry, onShare }: ReelCardProps) {
  const { post, reason } = item;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytEmbedUrl = getYouTubeEmbedUrl(post.videoUrl);

  const [upvoted, setUpvoted] = useState(Boolean(item.viewerState?.upvoted));
  const [upvoteCount, setUpvoteCount] = useState(post.stats.upvotes);
  const [saved, setSaved] = useState(Boolean(item.viewerState?.saved));
  const [following, setFollowing] = useState(Boolean(item.viewerState?.followingAuthor));
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);

  // Poster-first lazy media lifecycle for native videos
  useEffect(() => {
    if (ytEmbedUrl) return;
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      setPaused(false);
      video.play().catch(() => {
        setPaused(true);
      });
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isActive, ytEmbedUrl]);

  // Dwell telemetry
  useEffect(() => {
    if (!isActive) return;
    const started = Date.now();
    return () => {
      const dwellSec = Math.round((Date.now() - started) / 1000);
      if (dwellSec >= 2) {
        queueEvent({ type: "view", postId: post.id, value: dwellSec });
      }
    };
  }, [isActive, post.id]);

  function handleToggleUpvote() {
    const next = !upvoted;
    setUpvoted(next);
    setUpvoteCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
    if (next) {
      queueEvent({ type: "upvote", postId: post.id, value: item.viewerState?.tried ? 3 : 1 });
    }
  }

  async function handleToggleFollow() {
    const next = !following;
    setFollowing(next);
    try {
      await fetch(`/api/follow/${encodeURIComponent(post.author.id)}`, {
        method: next ? "POST" : "DELETE",
      });
    } catch {
      setFollowing(!next);
    }
  }

  function handleVideoClick() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
  }

  return (
    <article
      aria-label={`${post.title} by @${post.author.handle}`}
      className="relative w-full max-w-[660px] mx-auto rounded-2xl border border-border bg-surface shadow-sm overflow-hidden transition-shadow hover:shadow-md"
    >
      {/* Top Attribution & Category Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-surface">
        <ReasonChip reason={reason} />
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="rounded-md bg-dune px-2.5 py-0.5 font-medium text-ink border border-border">
            {post.category}
          </span>
          {post.health.verifiedUtility && (
            <span className="inline-flex items-center gap-1 rounded-md bg-sage-soft px-2.5 py-0.5 font-semibold text-sage">
              <span className="size-1.5 rounded-full bg-sage" />
              Verified Demo
            </span>
          )}
        </div>
      </div>

      {/* Main Reel Body */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_72px]">
        <div className="flex flex-col">
          {/* Video Pitch or YouTube Stage */}
          <div className="relative aspect-[16/10] w-full bg-ink overflow-hidden group">
            {ytEmbedUrl ? (
              isActive ? (
                <iframe
                  title={post.title}
                  src={ytEmbedUrl}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="relative h-full w-full">
                  <img
                    src={post.thumbUrl}
                    alt={post.title}
                    className="h-full w-full object-cover opacity-90"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-ink/30">
                    <span className="flex size-14 items-center justify-center rounded-full bg-surface/95 text-ink shadow-md">
                      <PlayIcon className="size-6 translate-x-0.5" />
                    </span>
                  </div>
                </div>
              )
            ) : (
              <>
                <video
                  ref={videoRef}
                  poster={post.thumbUrl}
                  src={ isActive ? post.videoUrl : undefined }
                  preload={isActive ? "metadata" : "none"}
                  loop
                  muted={muted}
                  playsInline
                  onClick={handleVideoClick}
                  className="h-full w-full object-cover cursor-pointer"
                />

                {/* Top-right Controls */}
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMuted((m) => !m);
                    }}
                    aria-label={muted ? "Unmute pitch video" : "Mute pitch video"}
                    className="rounded-lg bg-ink/80 px-2.5 py-1 text-xs font-medium text-dune hover:bg-ink transition-colors"
                  >
                    {muted ? "Muted" : "Sound On"}
                  </button>
                </div>

                {/* Play state indicator */}
                {paused && (
                  <button
                    type="button"
                    onClick={handleVideoClick}
                    aria-label="Play pitch video"
                    className="absolute inset-0 flex items-center justify-center bg-ink/30"
                  >
                    <span className="flex size-14 items-center justify-center rounded-full bg-surface/95 text-ink shadow-md">
                      <PlayIcon className="size-6 translate-x-0.5" />
                    </span>
                  </button>
                )}
              </>
            )}

            {/* Mode Pill */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2 pointer-events-none">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-ink/85 px-2.5 py-1 text-[11px] font-medium text-dune">
                <span className="size-1.5 rounded-full bg-sage" />
                {MODE_LABELS[post.demo.mode] ?? "Live Demo"}
              </span>
            </div>
          </div>

          {/* Problem-First Editorial Card */}
          <div className="p-4 sm:p-5 space-y-4">
            <div className="rounded-xl border border-border bg-dune/70 p-3.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
                  Problem Solved
                </span>
                {item.viewerState?.tried && (
                  <span className="rounded-md bg-sage-soft px-2 py-0.5 text-[11px] font-semibold text-sage">
                    Tested by you
                  </span>
                )}
              </div>
              <p className="text-sm sm:text-[15px] font-medium text-ink leading-snug text-pretty">
                {post.problemStatement}
              </p>
            </div>

            {/* Title & Tags */}
            <div className="space-y-2">
              <Link
                href={`/p/${post.id}`}
                className="block font-display text-lg sm:text-xl font-bold tracking-tight text-ink hover:text-accent transition-colors text-balance"
              >
                {post.title}
              </Link>
              <div className="flex flex-wrap items-center gap-1.5">
                {post.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/explore?q=${encodeURIComponent(tag)}`}
                    className="rounded-md bg-dune px-2 py-0.5 text-xs text-muted hover:text-ink transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>

            {/* Author & Follow Row */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
              <Link href={`/u/${post.author.handle}`} className="flex items-center gap-2.5 min-w-0 group">
                <img
                  src={post.author.avatarUrl}
                  alt={post.author.displayName}
                  width={36}
                  height={36}
                  className="size-9 rounded-full border border-border bg-dune object-cover shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold text-ink group-hover:text-accent transition-colors truncate">
                      {post.author.displayName}
                    </span>
                    {post.author.verifiedUtility && (
                      <VerifiedIcon className="size-4 text-sage shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted truncate">@{post.author.handle}</p>
                </div>
              </Link>

              <button
                type="button"
                onClick={handleToggleFollow}
                aria-pressed={following}
                className={cn(
                  "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  following
                    ? "border border-border bg-dune text-ink hover:bg-border/40"
                    : "bg-ink text-dune hover:bg-ink/90"
                )}
              >
                {following ? "Following" : "Follow"}
              </button>
            </div>

            {/* Clean Try Live Demo Dock */}
            <div className="pt-1 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => onTry(item)}
                className="flex-1 flex items-center justify-between gap-3 rounded-xl bg-accent px-4 py-3 text-white font-semibold text-sm hover:bg-accent-hover active:scale-[0.99] transition-colors shadow-sm"
              >
                <span className="flex items-center gap-2.5">
                  <TerminalIcon className="size-4 shrink-0" />
                  <span>Try Live Demo</span>
                </span>
                <span className="rounded-lg bg-ink/20 px-2.5 py-0.5 text-xs font-medium">
                  Launch →
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Action Rail */}
        <div className="flex md:flex-col items-center justify-around md:justify-start gap-2 border-t md:border-t-0 md:border-l border-border bg-dune/40 p-2.5 md:py-4">
          <button
            type="button"
            onClick={handleToggleUpvote}
            aria-label={upvoted ? "Remove upvote" : "Upvote project"}
            aria-pressed={upvoted}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl p-2 w-14 text-xs font-semibold transition-colors",
              upvoted
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface hover:text-ink"
            )}
          >
            <ArrowUpIcon className="size-5" />
            <span className="tabular-nums">{compact(upvoteCount)}</span>
          </button>

          <Link
            href={`/p/${post.id}`}
            aria-label="View project details and discussion"
            className="flex flex-col items-center gap-1 rounded-xl p-2 w-14 text-xs font-medium text-muted hover:bg-surface hover:text-ink transition-colors"
          >
            <MessageIcon className="size-5" />
            <span className="tabular-nums">{compact(post.stats.comments)}</span>
          </Link>

          <button
            type="button"
            onClick={() => setSaved((s) => !s)}
            aria-label={saved ? "Remove bookmark" : "Bookmark project"}
            aria-pressed={saved}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl p-2 w-14 text-xs font-medium transition-colors",
              saved ? "bg-amber-soft text-amber" : "text-muted hover:bg-surface hover:text-ink"
            )}
          >
            <BookmarkIcon className="size-5" />
            <span>{saved ? "Saved" : "Save"}</span>
          </button>

          <button
            type="button"
            onClick={() => onShare(item)}
            aria-label="Share project"
            className="flex flex-col items-center gap-1 rounded-xl p-2 w-14 text-xs font-medium text-muted hover:bg-surface hover:text-ink transition-colors"
          >
            <ShareIcon className="size-5" />
            <span>Share</span>
          </button>
        </div>
      </div>
    </article>
  );
}
