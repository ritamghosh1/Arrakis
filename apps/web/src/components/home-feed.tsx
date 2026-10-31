"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { FeedItem, FeedResponse, Post } from "@arrakis/contracts";
import { cn, VIEWER_ID } from "@/lib/utils";
import { track } from "@/lib/events";
import { FreshBuilds } from "./fresh-builds";
import { ReelCard } from "./reel-card";
import { TrySheet } from "./try-sheet";

type Mode = "for_you" | "following";
type Status = "idle" | "loading" | "error";

function Skeleton() {
  return (
    <div className="h-full p-2" aria-hidden="true">
      <div className="bg-paper-sunken mx-auto h-full max-w-[26rem] animate-pulse rounded-[var(--radius-card)]" />
    </div>
  );
}

export function HomeFeed({ initial, freshBuilds }: { initial: FeedResponse; freshBuilds: Post[] }) {
  const [mode, setMode] = useState<Mode>("for_you");
  const [items, setItems] = useState<FeedItem[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [status, setStatus] = useState<Status>("idle");
  const [activeId, setActiveId] = useState<string | null>(initial.items[0]?.post.id ?? null);
  const [upvoted, setUpvoted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initial.items.map((i) => [i.post.id, Boolean(i.viewerState?.upvoted)])),
  );
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [following, setFollowing] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initial.items.map((i) => [i.post.authorId, Boolean(i.viewerState?.followingAuthor)])),
  );
  const [tryPost, setTryPost] = useState<Post | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const load = useCallback(
    async (nextMode: Mode, nextCursor: string | null, replace: boolean) => {
      const id = ++reqId.current;
      setStatus("loading");
      try {
        const qs = new URLSearchParams({ mode: nextMode, userId: VIEWER_ID });
        if (nextCursor) qs.set("cursor", nextCursor);
        const res = await fetch(`/api/feed/home?${qs}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as FeedResponse;
        if (id !== reqId.current) return; // a newer request superseded this one
        setItems((prev) => (replace ? data.items : [...prev, ...data.items]));
        setCursor(data.nextCursor);
        setUpvoted((u) => ({ ...u, ...Object.fromEntries(data.items.map((i) => [i.post.id, u[i.post.id] ?? Boolean(i.viewerState?.upvoted)])) }));
        setFollowing((f) => ({ ...f, ...Object.fromEntries(data.items.map((i) => [i.post.authorId, f[i.post.authorId] ?? Boolean(i.viewerState?.followingAuthor)])) }));
        if (replace) {
          setActiveId(data.items[0]?.post.id ?? null);
          scrollerRef.current?.scrollTo({ top: 0 });
        }
        setStatus("idle");
      } catch {
        if (id === reqId.current) setStatus("error");
      }
    },
    [],
  );

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setItems([]);
    setCursor(null);
    void load(next, null, true);
  }

  // Track which reel is active: scroll-snap events where supported, IntersectionObserver otherwise.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    if ("onscrollsnapchange" in HTMLElement.prototype) {
      const onSnap = (e: Event) => {
        const target = (e as Event & { snapTargetBlock?: Element | null }).snapTargetBlock;
        const id = target?.getAttribute("data-post-id") ?? target?.querySelector("[data-post-id]")?.getAttribute("data-post-id");
        if (id) setActiveId(id);
      };
      root.addEventListener("scrollsnapchange", onSnap);
      return () => root.removeEventListener("scrollsnapchange", onSnap);
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveId(e.target.getAttribute("data-post-id"));
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-post-id]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  // Infinite pagination when nearing the end.
  const activeIndex = items.findIndex((i) => i.post.id === activeId);
  useEffect(() => {
    if (cursor && status === "idle" && activeIndex >= 0 && activeIndex >= items.length - 3) {
      void load(mode, cursor, false);
    }
  }, [activeIndex, cursor, items.length, load, mode, status]);

  const scrollBy = useCallback((dir: 1 | -1) => {
    const root = scrollerRef.current;
    if (root) root.scrollBy({ top: dir * root.clientHeight, behavior: "smooth" });
  }, []);

  // Keyboard: j/k move between reels, t = try, u = upvote, / = jump to Explore search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input,textarea,select,dialog[open]") || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const cur = items[activeIndex];
      if (e.key === "j") scrollBy(1);
      else if (e.key === "k") scrollBy(-1);
      else if (e.key === "t" && cur) setTryPost(cur.post);
      else if (e.key === "u" && cur) toggleUpvote(cur.post);
      else if (e.key === "/") {
        e.preventDefault();
        window.location.assign("/explore?focus=1");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, activeIndex, scrollBy]);

  function toggleUpvote(post: Post) {
    const next = !upvoted[post.id];
    setUpvoted((u) => ({ ...u, [post.id]: next })); // optimistic
    if (next) track("upvote", post.id, 1);
  }

  async function toggleFollow(post: Post) {
    const was = Boolean(following[post.authorId]);
    setFollowing((f) => ({ ...f, [post.authorId]: !was })); // optimistic
    try {
      const res = await fetch(`/api/follow/${post.authorId}?followerId=${VIEWER_ID}`, { method: was ? "DELETE" : "POST" });
      if (!res.ok) throw new Error(String(res.status));
      if (!was) track("follow", undefined, 1, post.authorId);
      say(was ? `Unfollowed @${post.author.handle}` : `Following @${post.author.handle}`);
    } catch {
      setFollowing((f) => ({ ...f, [post.authorId]: was })); // rollback
      say("Could not update follow. Try again.");
    }
  }

  async function share(post: Post) {
    const url = `${window.location.origin}/p/${post.id}`;
    track("share", post.id, 0.4);
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, text: post.problemStatement, url });
        return;
      } catch (err) {
        if ((err as DOMException).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      say("Link copied");
    } catch {
      say(url);
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <header className="pt-safe bg-paper z-feed flex flex-col gap-2 pt-2">
        <div className="flex items-center justify-between px-3">
          <h1 className="font-display text-2xl font-bold">Home</h1>
          <div role="group" aria-label="Feed type" className="bg-paper-sunken flex rounded-full p-1 text-sm font-semibold">
            {(
              [
                ["for_you", "For you"],
                ["following", "Following"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => switchMode(m)}
                className={cn(
                  "rounded-full px-3 py-1.5 transition-colors",
                  mode === m ? "bg-ink text-paper" : "text-ink-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <FreshBuilds posts={freshBuilds} />
      </header>

      <div
        ref={scrollerRef}
        className="feed-scroller min-h-0 flex-1 overflow-y-auto"
        tabIndex={-1}
        aria-busy={status === "loading"}
      >
        {items.map((item) => (
          <div key={item.post.id} className="h-full">
            <ReelCard
              item={item}
              active={item.post.id === activeId}
              upvoted={Boolean(upvoted[item.post.id])}
              saved={Boolean(saved[item.post.id])}
              following={Boolean(following[item.post.authorId])}
              onUpvote={() => toggleUpvote(item.post)}
              onSave={() => setSaved((s) => ({ ...s, [item.post.id]: !s[item.post.id] }))}
              onFollow={() => void toggleFollow(item.post)}
              onTry={() => setTryPost(item.post)}
              onShare={() => void share(item.post)}
            />
          </div>
        ))}

        {status === "loading" && items.length === 0 && (
          <>
            <div className="feed-item h-full">
              <Skeleton />
            </div>
          </>
        )}

        {status === "error" && (
          <div className="feed-item grid h-full place-items-center p-6">
            <div className="max-w-xs text-center">
              <p className="font-display text-lg font-bold">We could not load the feed</p>
              <p className="text-ink-muted mt-1 text-sm">Check that the recommender is running, or switch to mock mode.</p>
              <button
                type="button"
                onClick={() => void load(mode, items.length ? cursor : null, items.length === 0)}
                className="bg-primary text-primary-ink mt-4 rounded-full px-5 py-2.5 font-semibold"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {status === "idle" && items.length === 0 && (
          <div className="feed-item grid h-full place-items-center p-6">
            <div className="max-w-xs text-center">
              <p className="font-display text-lg font-bold text-balance">
                {mode === "following" ? "Nobody you follow has posted yet" : "No reels yet"}
              </p>
              <p className="text-ink-muted mt-1 text-sm text-pretty">
                Follow a few builders and their latest demos will land here with a note on who recommended them.
              </p>
              <Link href="/explore" className="bg-primary text-primary-ink mt-4 inline-block rounded-full px-5 py-2.5 font-semibold">
                Find builders in Explore
              </Link>
            </div>
          </div>
        )}

        {status === "idle" && items.length > 0 && !cursor && (
          <div className="grid h-24 place-items-center">
            <p className="text-ink-muted text-sm">You are all caught up.</p>
          </div>
        )}
      </div>

      <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        {toast && (
          <p className="bg-ink text-paper z-toast max-w-[90%] truncate rounded-full px-4 py-2 text-sm shadow-lg">{toast}</p>
        )}
      </div>

      <TrySheet post={tryPost} onClose={() => setTryPost(null)} />
    </div>
  );
}
