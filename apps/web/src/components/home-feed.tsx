"use client";

import { deduplicatePosts, type FeedItem, type Post, type User } from "@arrakis/contracts";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FreshBuilds } from "./fresh-builds";
import { SparklesIcon, TrophyIcon, VerifiedIcon } from "./icons";
import { ReelCard } from "./reel-card";
import { ShareSheet } from "./share-sheet";
import { TrySheet } from "./try-sheet";
import { cn } from "@/lib/utils";

interface HomeFeedProps {
  initialItems: FeedItem[];
  freshPosts: Post[];
  suggestedUsers: User[];
}

export function HomeFeed({ initialItems, freshPosts, suggestedUsers }: HomeFeedProps) {
  const [mode, setMode] = useState<"for_you" | "following">("for_you");
  const [items, setItems] = useState<FeedItem[]>(() => deduplicatePosts(initialItems));
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTryPost, setActiveTryPost] = useState<Post | null>(null);
  const [activeSharePost, setActiveSharePost] = useState<Post | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [followedSuggestions, setFollowedSuggestions] = useState<Record<string, boolean>>({});
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const root = scrollerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            const idx = Number((entry.target as HTMLElement).dataset.index ?? 0);
            setActiveIndex(idx);
          }
        }
      },
      { root, threshold: [0.55] }
    );

    for (const el of cardRefs.current) {
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [items]);

  // Keyboard shortcuts (j = next, k = prev, t = try active)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const scrollBehavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? "auto"
        : "smooth";
      if (e.key === "j") {
        e.preventDefault();
        const nextIdx = Math.min(items.length - 1, activeIndex + 1);
        cardRefs.current[nextIdx]?.scrollIntoView({ behavior: scrollBehavior, block: "start" });
      } else if (e.key === "k") {
        e.preventDefault();
        const prevIdx = Math.max(0, activeIndex - 1);
        cardRefs.current[prevIdx]?.scrollIntoView({ behavior: scrollBehavior, block: "start" });
      } else if (e.key === "t") {
        e.preventDefault();
        const current = items[activeIndex];
        if (current) setActiveTryPost(current.post);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, items]);

  async function handleSwitchMode(nextMode: "for_you" | "following") {
    setMode(nextMode);
    try {
      const res = await fetch(`/api/feed?mode=${nextMode}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          setItems(deduplicatePosts(data.items));
          setActiveIndex(0);
          scrollerRef.current?.scrollTo({ top: 0 });
          return;
        }
      }
    } catch {
      // Fallback to local filter
    }
    if (nextMode === "following") {
      setItems(deduplicatePosts(initialItems.filter((item) => item.reason.kind === "followed")));
    } else {
      setItems(deduplicatePosts(initialItems));
    }
    setActiveIndex(0);
    scrollerRef.current?.scrollTo({ top: 0 });
  }

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3600);
  }

  function handleTrialCompleted(postId: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.post.id === postId
          ? {
              ...item,
              viewerState: {
                upvoted: Boolean(item.viewerState?.upvoted),
                saved: Boolean(item.viewerState?.saved),
                followingAuthor: Boolean(item.viewerState?.followingAuthor),
                tried: true,
              },
            }
          : item
      )
    );
    showToast("Feedback saved! Thanks for testing this build.");
  }

  async function handleToggleFollowUser(userId: string) {
    const next = !followedSuggestions[userId];
    setFollowedSuggestions((prev) => ({ ...prev, [userId]: next }));
    try {
      await fetch(`/api/follow/${encodeURIComponent(userId)}`, {
        method: next ? "POST" : "DELETE",
      });
    } catch {
      // Ignore offline error
    }
  }

  return (
    <div className="mx-auto flex flex-1 h-full w-full max-w-[1140px] min-h-0 flex-col sm:px-6 overflow-hidden">
      {/* Top Feed Bar (Zero horizontal divider lines across the screen) */}
      <header className="pt-safe z-feed flex shrink-0 items-center justify-between gap-2 bg-dune px-3 py-2 sm:px-2 sm:py-2.5">
        {/* Mobile App Logo (shown below lg where left rail is hidden) */}
        <Link
          href="/"
          className="flex lg:hidden items-center gap-2 focus-visible:outline-none"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-ink text-dune font-display text-xs font-bold tracking-tight">
            A
          </span>
          <span className="font-display text-base font-bold tracking-tight text-ink">
            Arrakis
          </span>
        </Link>

        <h1 className="hidden lg:block font-display text-xl font-bold tracking-tight text-ink">
          Utility Feed
        </h1>

        {/* For You / Following Toggle */}
        <div
          role="group"
          aria-label="Feed mode"
          className="flex items-center gap-1 rounded-full bg-surface p-0.5 sm:p-1 shadow-xs"
        >
          <button
            type="button"
            onClick={() => handleSwitchMode("for_you")}
            aria-pressed={mode === "for_you"}
            className={cn(
              "rounded-full px-3 sm:px-4 py-1 text-xs font-semibold transition-colors",
              mode === "for_you" ? "bg-ink text-dune" : "text-muted hover:text-ink"
            )}
          >
            For You
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode("following")}
            aria-pressed={mode === "following"}
            className={cn(
              "rounded-full px-3 sm:px-4 py-1 text-xs font-semibold transition-colors",
              mode === "following" ? "bg-ink text-dune" : "text-muted hover:text-ink"
            )}
          >
            Following
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 font-medium text-ink shadow-xs">
            <SparklesIcon className="size-3.5 text-accent" />
            Real working demos · Zero clout bias
          </span>
        </div>
      </header>

      {/* Main Viewport: Full-Screen Snap Reel Scroller (1 demo at a time) + Desktop Context Rail */}
      <div className="flex flex-1 min-h-0 h-full gap-7 items-stretch overflow-hidden">
        {/* Full-Height Vertical Snap Reel Scroller */}
        <div
          ref={scrollerRef}
          className="feed-scroller flex-1 min-h-0 h-full w-full overflow-y-auto"
          tabIndex={-1}
        >
          {items.length === 0 ? (
            <div className="feed-item grid h-full place-items-center p-6">
              <div className="rounded-2xl bg-surface p-8 text-center space-y-3 max-w-sm shadow-sm">
                <p className="font-display text-base font-bold text-ink">
                  No builds in your Following feed yet
                </p>
                <p className="text-sm text-muted">
                  Switch back to For You or follow builders to see their latest releases.
                </p>
                <button
                  type="button"
                  onClick={() => handleSwitchMode("for_you")}
                  className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-dune"
                >
                  Back to For You
                </button>
              </div>
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.post.id}
                data-index={idx}
                ref={(el) => {
                  cardRefs.current[idx] = el;
                }}
                className="feed-item h-full w-full sm:py-2"
              >
                <ReelCard
                  item={item}
                  isActive={idx === activeIndex}
                  onTry={(it) => setActiveTryPost(it.post)}
                  onShare={(it) => setActiveSharePost(it.post)}
                />
              </div>
            ))
          )}
        </div>

        {/* Right Context Rail (Desktop >= 1280px only — keeps mobile 100% single-reel fullscreen) */}
        <aside className="hidden xl:flex xl:w-[310px] xl:shrink-0 xl:flex-col xl:gap-4 xl:py-2 xl:overflow-y-auto">
          {/* Fresh Builds Spotlight */}
          <div className="rounded-2xl bg-surface p-4 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="font-display text-sm font-bold text-ink">Fresh Builds</h2>
                <p className="text-[11px] text-muted">New launches from emerging builders</p>
              </div>
              <Link
                href="/explore"
                className="text-xs font-semibold text-accent hover:underline"
              >
                Explore →
              </Link>
            </div>
            <FreshBuilds posts={freshPosts} />
          </div>

          {/* Builders to Follow */}
          <div className="rounded-2xl bg-surface p-4 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-ink">Builders to Follow</h2>
              <Link href="/ranks" className="text-xs font-semibold text-accent hover:underline">
                Standings
              </Link>
            </div>

            <div className="space-y-3">
              {suggestedUsers.slice(0, 5).map((u) => {
                const isFollowed = Boolean(followedSuggestions[u.id]);
                return (
                  <div key={u.id} className="flex items-center justify-between gap-2.5">
                    <Link href={`/u/${u.handle}`} className="flex items-center gap-2.5 min-w-0 group">
                      <img
                        src={u.avatarUrl}
                        alt={u.displayName}
                        className="size-9 rounded-full bg-dune object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-semibold text-ink group-hover:text-accent truncate">
                            {u.displayName}
                          </span>
                          {u.verifiedUtility && (
                            <VerifiedIcon className="size-3.5 text-sage shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted truncate">@{u.handle}</p>
                      </div>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleToggleFollowUser(u.id)}
                      className={cn(
                        "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors shrink-0",
                        isFollowed
                          ? "bg-dune text-ink"
                          : "bg-ink text-dune hover:bg-ink/90"
                      )}
                    >
                      {isFollowed ? "Following" : "Follow"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Community Standings Card */}
          <div className="rounded-2xl bg-surface p-4 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-ink">
              <TrophyIcon className="size-4 text-accent" />
              <h3 className="font-display text-sm font-bold">Community Standings</h3>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Projects are ranked by hands-on community testing and real working demos rather than follower count.
            </p>
            <Link
              href="/ranks"
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline pt-1"
            >
              View Top Builders & Tools →
            </Link>
          </div>
        </aside>
      </div>

      {/* Live Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 lg:bottom-6 right-6 z-toast rounded-full bg-ink px-4 py-2.5 text-xs font-semibold text-dune shadow-lg"
        >
          {toastMessage}
        </div>
      )}

      {/* Try-It Sandbox Sheet */}
      <TrySheet
        post={activeTryPost}
        onClose={() => setActiveTryPost(null)}
        onTrialCompleted={handleTrialCompleted}
      />

      {/* Share Sheet */}
      <ShareSheet post={activeSharePost} onClose={() => setActiveSharePost(null)} />
    </div>
  );
}
