"use client";

import type { Post } from "@arrakis/contracts";
import { useState } from "react";
import { PlayIcon, ShareIcon, TerminalIcon } from "./icons";
import { InAppBrowser } from "./in-app-browser";
import { ShareSheet } from "./share-sheet";
import { TrySheet } from "./try-sheet";
import { cn, getYouTubeEmbedUrl } from "@/lib/utils";

export function PostDetailClient({ post }: { post: Post }) {
  const [stageTab, setStageTab] = useState<"browser" | "video">("browser");
  const [tryOpen, setTryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<
    { id: string; handle: string; text: string; time: string }[]
  >([
    {
      id: "c1",
      handle: "srinjoy",
      text: "Tested the live demo in the in-app browser — super clean output and zero setup needed.",
      time: "2h ago",
    },
    {
      id: "c2",
      handle: "devika",
      text: "Worked right away on my sample payload. Great job on the schema defaults!",
      time: "5h ago",
    },
  ]);

  const ytEmbedUrl = getYouTubeEmbedUrl(post.videoUrl);

  function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setComments((prev) => [
      {
        id: `c_${Date.now()}`,
        handle: "ritam",
        text: commentText.trim(),
        time: "Just now",
      },
      ...prev,
    ]);
    setCommentText("");
  }

  return (
    <div className="space-y-6">
      {/* Stage Switcher: In-App Browser vs Pitch Video */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-dune p-1">
          <button
            type="button"
            onClick={() => setStageTab("browser")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors",
              stageTab === "browser"
                ? "bg-ink text-dune shadow-sm"
                : "text-muted hover:text-ink"
            )}
          >
            <TerminalIcon className="size-3.5" />
            <span>In-App Browser</span>
          </button>
          <button
            type="button"
            onClick={() => setStageTab("video")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors",
              stageTab === "video"
                ? "bg-ink text-dune shadow-sm"
                : "text-muted hover:text-ink"
            )}
          >
            <PlayIcon className="size-3.5" />
            <span>Pitch Video</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover transition-colors shadow-sm"
          >
            <TerminalIcon className="size-3.5" />
            <span>Open Full-Screen Sandbox</span>
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-dune px-3.5 py-2 text-xs font-semibold text-ink hover:bg-border/50 transition-colors"
          >
            <ShareIcon className="size-3.5" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Stage Body */}
      {stageTab === "browser" ? (
        <InAppBrowser post={post} className="min-h-[500px]" />
      ) : (
        <div className="aspect-[16/10] w-full rounded-2xl overflow-hidden bg-ink border border-border">
          {ytEmbedUrl ? (
            <iframe
              title={post.title}
              src={ytEmbedUrl}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={post.videoUrl}
              poster={post.thumbUrl}
              controls
              playsInline
              className="h-full w-full object-cover"
            />
          )}
        </div>
      )}

      {/* Discussion / Builder Feedback */}
      <section className="pt-4 border-t border-border space-y-4">
        <h2 className="font-display text-base font-bold text-ink">
          Builder Discussion ({comments.length})
        </h2>

        <form onSubmit={handleAddComment} className="flex gap-2.5">
          <input
            type="text"
            placeholder="Share feedback or ask a question..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-dune/50 px-3.5 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-dune hover:bg-ink/90 transition-colors shrink-0"
          >
            Post Note
          </button>
        </form>

        <div className="space-y-2.5">
          {comments.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-dune/40 p-3.5 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-ink">@{c.handle}</span>
                <span className="text-muted">{c.time}</span>
              </div>
              <p className="text-xs sm:text-sm text-ink">{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      <TrySheet post={tryOpen ? post : null} onClose={() => setTryOpen(false)} />
      <ShareSheet post={shareOpen ? post : null} onClose={() => setShareOpen(false)} />
    </div>
  );
}
