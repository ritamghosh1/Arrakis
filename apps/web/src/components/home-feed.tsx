"use client";

import type { FeedItem, Post, User } from "@arrakis/contracts";
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
  const [items, setItems] = useState<FeedItem[]>(initialItems);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTryPost, setActiveTryPost] = useState<Post | null>(null);
  const [activeSharePost, setActiveSharePost] = useState<Post | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [followedSuggestions, setFollowedSuggestions] = useState<Record<string, boolean>>({});
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            const idx = Number((entry.target as HTMLElement).dataset.index ?? 0);
            setActiveIndex(idx);
          }
        }
      },
      { threshold: [0.55] }
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
      if (e.key === "j") {
        e.preventDefault();
        const nextIdx = Math.min(items.length - 1, activeIndex + 1);
        cardRefs.current[nextIdx]?.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (e.key === "k") {
        e.preventDefault();
        const prevIdx = Math.max(0, activeIndex - 1);
        cardRefs.current[prevIdx]?.scrollIntoView({ behavior: "smooth", block: "center" });
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
      const res = await fetch(`/api/feed/home?mode=${nextMode}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items);
          setActiveIndex(0);
          return;
        }
      }
    } catch {
      // Fallback to local filter
    }
    if (nextMode === "following") {
      setItems(initialItems.filter((item) => item.reason.kind === "followed"));
    } else {
      setItems(initialItems);
    }
    setActiveIndex(0);
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
    <div className="mx-auto max-w-[1140px] px-4 sm:px-6 py-5 lg:py-7">
      {/* Top Feed Header */}
      <header className="sticky top-0 z-feed mb-6 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface/95 backdrop-blur-md px-4 py-3 shadow-sm">
        {/* Mobile App Logo (shown below lg where left rail is hidden) */}
        <Link
          href="/"
          className="flex lg:hidden items-center gap-2.5 focus-visible:outline-none"
        >
          <span className="flex size-8 items-center justify-center rounded-xl bg-ink text-dune font-display text-sm font-bold tracking-tight">
            A
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-ink">
            Arrakis
          </span>
        </Link>

        {/* For You / Following Toggle */}
        <div className="flex items-center gap-1 rounded-xl bg-dune p-1 border border-border">
          <button
            type="button"
            onClick={() => handleSwitchMode("for_you")}
            aria-pressed={mode === "for_you"}
            className={cn(
              "rounded-lg px-3.5 sm:px-4 py-1.5 text-xs font-semibold transition-colors",
              mode === "for_you" ? "bg-ink text-dune shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            For You
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode("following")}
            aria-pressed={mode === "following"}
            className={cn(
              "rounded-lg px-3.5 sm:px-4 py-1.5 text-xs font-semibold transition-colors",
              mode === "following" ? "bg-ink text-dune shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            Following
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-dune px-2.5 py-1 font-medium text-ink border border-border">
            <SparklesIcon className="size-3.5 text-accent" />
            Real working demos · Zero clout bias
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_310px] gap-7 items-start">
        {/* Main Feed Column */}
        <div className="space-y-6 min-w-0">
          {/* Fresh Builds Spotlight Rail */}
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3 px-1">
              <div>
                <h2 className="font-display text-sm font-bold text-ink">Fresh Builds</h2>
                <p className="text-xs text-muted">New launches from emerging builders</p>
              </div>
              <Link
                href="/explore"
                className="text-xs font-semibold text-accent hover:underline"
              >
                Explore all →
              </Link>
            </div>
            <FreshBuilds posts={freshPosts} />
          </div>

          {/* Reels Stack */}
          {items.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-10 text-center space-y-3">
              <p className="font-display text-base font-bold text-ink">
                No builds in your Following feed yet
              </p>
              <p className="text-sm text-muted max-w-md mx-auto">
                Switch back to For You or follow builders on the right to see their latest releases.
              </p>
              <button
                type="button"
                onClick={() => handleSwitchMode("for_you")}
                className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-dune"
              >
                Back to For You
              </button>
            </div>
          ) : (
            <div className="space-y-7">
              {items.map((item, idx) => (
                <div
                  key={item.post.id}
                  data-index={idx}
                  ref={(el) => {
                    cardRefs.current[idx] = el;
                  }}
                >
                  <ReelCard
                    item={item}
                    isActive={idx === activeIndex}
                    onTry={(it) => setActiveTryPost(it.post)}
                    onShare={(it) => setActiveSharePost(it.post)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Context Rail (Desktop >= 1280px) */}
        <aside className="hidden xl:block space-y-5 sticky top-24">
          {/* Builders to Follow */}
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm space-y-3.5">
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
                        className="size-9 rounded-full border border-border bg-dune object-cover shrink-0"
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
                        "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors shrink-0",
                        isFollowed
                          ? "border border-border bg-dune text-ink"
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
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm space-y-2.5">
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
          className="fixed bottom-20 lg:bottom-6 right-6 z-toast rounded-xl border border-sage/40 bg-ink px-4 py-3 text-xs font-semibold text-dune shadow-lg"
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
