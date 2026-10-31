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
  container: "Live Sandbox",
  api: "Interactive API",
  web: "Web App",
  handoff: "Desktop App",
};

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
      data-post-id={post.id}
      className="relative h-full w-full max-w-[440px] mx-auto sm:rounded-2xl bg-ink text-dune overflow-hidden shadow-md flex flex-col justify-between"
    >
      {/* Full-Bleed Background Media Stage (zero internal border lines) */}
      <div className="absolute inset-0 bg-ink">
        <img
          src={post.thumbUrl}
          alt={post.title}
          loading={isActive ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover opacity-85"
        />

        {ytEmbedUrl ? (
          isActive && (
            <iframe
              title={post.title}
              src={ytEmbedUrl}
              className="absolute inset-x-0 top-14 h-[46%] w-full border-0 bg-ink"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )
        ) : (
          <video
            ref={videoRef}
            poster={post.thumbUrl}
            src={isActive ? post.videoUrl : undefined}
            preload={isActive ? "metadata" : "none"}
            loop
            muted={muted}
            playsInline
            onClick={handleVideoClick}
            className="absolute inset-0 h-full w-full object-cover opacity-90 cursor-pointer"
          />
        )}

        {/* Play indicator when paused */}
        {!ytEmbedUrl && paused && (
          <button
            type="button"
            onClick={handleVideoClick}
            aria-label="Play pitch video"
            className="absolute inset-0 flex items-center justify-center bg-ink/25"
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-surface/95 text-ink shadow-md">
              <PlayIcon className="size-6 translate-x-0.5" />
            </span>
          </button>
        )}
      </div>

      {/* Top Overlay Bar: Reason Attribution + Category & Sound */}
      <div className="relative z-feed flex items-start justify-between gap-2 p-2.5 sm:p-3.5">
        <div className="min-w-0 flex-1">
          <ReasonChip reason={reason} />
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-ink/85 px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-dune">
              {MODE_LABEL[post.demo.mode] ?? "Live Demo"}
            </span>
            {!ytEmbedUrl && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMuted((m) => !m);
                }}
                aria-label={muted ? "Unmute pitch video" : "Mute pitch video"}
                className="rounded-full bg-ink/85 px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-dune hover:bg-ink transition-colors"
              >
                {muted ? "Muted" : "Sound"}
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            {post.health.verifiedUtility && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-2.5 py-0.5 text-[10px] font-semibold text-sage-soft">
                <span className="size-1.5 rounded-full bg-sage" />
                Verified Demo
              </span>
            )}
            <span
              className="rounded-full bg-ink/85 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-dune"
              title="Bayesian Usability Score and Popularity Score"
            >
              <span className="text-sage-soft">Use {(post.usabilityScore ?? 1.45).toFixed(2)}</span>
              <span className="text-dune/40 mx-1">·</span>
              <span>Pop {Math.round(post.popularityScore ?? post.postScore)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Right Floating Action Rail (Instagram Reels style — sits cleanly above bottom Try bar) */}
      <div className="absolute right-2.5 sm:right-3 bottom-16 sm:bottom-20 z-feed flex flex-col items-center gap-2 sm:gap-2.5">
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={handleToggleUpvote}
            aria-label={upvoted ? "Remove upvote" : "Upvote project"}
            aria-pressed={upvoted}
            className={cn(
              "grid size-10 sm:size-11 place-items-center rounded-full shadow-sm transition-transform active:scale-95",
              upvoted
                ? "bg-accent text-white"
                : "bg-ink/85 text-dune hover:bg-ink"
            )}
          >
            <ArrowUpIcon className="size-4 sm:size-5" />
          </button>
          <span className="rounded-full bg-ink/85 px-2 py-0.5 text-[10px] font-semibold text-dune tabular-nums">
            {compact(upvoteCount)}
          </span>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <Link
            href={`/p/${post.id}`}
            aria-label="View project details and discussion"
            className="grid size-10 sm:size-11 place-items-center rounded-full bg-ink/85 text-dune shadow-sm hover:bg-ink transition-transform active:scale-95"
          >
            <MessageIcon className="size-4 sm:size-5" />
          </Link>
          <span className="rounded-full bg-ink/85 px-2 py-0.5 text-[10px] font-semibold text-dune tabular-nums">
            {compact(post.stats.comments)}
          </span>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={() => setSaved((s) => !s)}
            aria-label={saved ? "Remove bookmark" : "Bookmark project"}
            aria-pressed={saved}
            className={cn(
              "grid size-10 sm:size-11 place-items-center rounded-full shadow-sm transition-transform active:scale-95",
              saved
                ? "bg-amber text-white"
                : "bg-ink/85 text-dune hover:bg-ink"
            )}
          >
            <BookmarkIcon className="size-4 sm:size-5" />
          </button>
          <span className="rounded-full bg-ink/85 px-2 py-0.5 text-[10px] font-semibold text-dune">
            {saved ? "Saved" : "Save"}
          </span>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            onClick={() => onShare(item)}
            aria-label="Share project"
            className="grid size-10 sm:size-11 place-items-center rounded-full bg-ink/85 text-dune shadow-sm hover:bg-ink transition-transform active:scale-95"
          >
            <ShareIcon className="size-4 sm:size-5" />
          </button>
          <span className="rounded-full bg-ink/85 px-2 py-0.5 text-[10px] font-semibold text-dune">
            Share
          </span>
        </div>
      </div>

      {/* Bottom Overlay: Builder Pill + Problem Card + 1-Tap Try Live Demo Dock */}
      <div className="relative z-feed mt-auto flex flex-col gap-2 p-2.5 sm:p-3.5">
        {/* Author Pill & Problem Card leave right space for the action rail */}
        <div className="flex flex-col gap-2 pr-14 sm:pr-16">
          {/* Author & Follow Pill */}
          <div className="flex items-center gap-2">
            <Link
              href={`/u/${post.author.handle}`}
              className="flex min-w-0 items-center gap-2 rounded-full bg-ink/85 py-1 pl-1 pr-3 text-dune hover:bg-ink transition-colors"
            >
              <img
                src={post.author.avatarUrl}
                alt={post.author.displayName}
                width={28}
                height={28}
                className="size-6 sm:size-7 rounded-full bg-dune object-cover shrink-0"
              />
              <span className="truncate text-xs font-bold">@{post.author.handle}</span>
              {post.author.verifiedUtility && (
                <VerifiedIcon className="size-3.5 text-sage shrink-0" />
              )}
            </Link>

            <button
              type="button"
              onClick={handleToggleFollow}
              aria-pressed={following}
              className={cn(
                "ml-auto shrink-0 rounded-full px-3 py-1 text-[11px] sm:text-xs font-bold transition-transform active:scale-95",
                following
                  ? "bg-ink/85 text-dune"
                  : "bg-dune text-ink hover:bg-surface"
              )}
            >
              {following ? "Following" : "+ Follow"}
            </button>
          </div>

          {/* Problem-First Overlay Card */}
          <div className="rounded-2xl bg-ink/90 p-3 sm:p-3.5 text-dune shadow-sm space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent-soft truncate">
                {post.category} · Problem Solved
              </span>
              {item.viewerState?.tried && (
                <span className="rounded-full bg-sage/30 px-2 py-0.5 text-[10px] font-semibold text-sage-soft shrink-0">
                  Tested by you
                </span>
              )}
            </div>

            {post.hackathonName && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <Link
                  href="/hackathons"
                  className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/30 transition-colors"
                >
                  <span>🏆 Built at {post.hackathonName}</span>
                </Link>
              </div>
            )}

            {Boolean(post.isDuplicateFlagged || post.tags?.includes("flagged-duplicate") || post.demo?.isDuplicateFlagged) && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/25 border border-rose-500/50 px-2 py-0.5 text-[10px] font-bold text-rose-200">
                  <span>⚠️ Flagged: Duplicate Git SHA</span>
                </span>
              </div>
            )}

            <Link
              href={`/p/${post.id}`}
              className="block font-display text-sm sm:text-[17px] leading-snug font-bold text-dune hover:text-accent-soft transition-colors text-balance line-clamp-2"
            >
              {post.title}
            </Link>

            <p className="text-xs sm:text-[13px] leading-relaxed text-dune/90 line-clamp-2 text-pretty">
              {post.problemStatement}
            </p>

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {post.tags.slice(0, 3).map((tag) => (
                <Link
                  key={tag}
                  href={`/explore?q=${encodeURIComponent(tag)}`}
                  className="rounded-md bg-dune/15 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-dune/90 hover:bg-dune/25 transition-colors"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Primary 1-Tap Try Live Demo Button + View Project Page Link (Full Width) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onTry(item)}
            className="flex-1 flex h-11 sm:h-12 items-center justify-between gap-2 rounded-full bg-accent px-4 sm:px-5 text-white font-bold text-xs sm:text-sm hover:bg-accent-hover active:scale-[0.98] transition-transform shadow-md"
          >
            <span className="flex items-center gap-2">
              <TerminalIcon className="size-4 shrink-0" />
              <span>Try Live Demo</span>
            </span>
            <span className="rounded-full bg-ink/25 px-2.5 sm:px-3 py-0.5 text-[11px] sm:text-xs font-semibold">
              In-App Browser →
            </span>
          </button>

          <Link
            href={`/p/${post.id}`}
            aria-label="View project page and in-tab browser"
            className="grid size-11 sm:size-12 place-items-center rounded-full bg-ink/85 text-dune shadow-md hover:bg-ink transition-transform active:scale-95 shrink-0 text-sm font-bold"
          >
            ↗
          </Link>
        </div>
      </div>
    </article>
  );
}
