"use client";

import type { Post } from "@arrakis/contracts";
import { useState } from "react";
import { ShareIcon, TerminalIcon } from "./icons";
import { ShareSheet } from "./share-sheet";
import { TrySheet } from "./try-sheet";
import { getYouTubeEmbedUrl } from "@/lib/utils";

export function PostDetailClient({ post }: { post: Post }) {
  const [tryOpen, setTryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<
    { id: string; handle: string; text: string; time: string }[]
  >([
    {
      id: "c1",
      handle: "srinjoy",
      text: "Tested the live demo — super clean output and zero setup needed.",
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
      {/* Video or YouTube Stage */}
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

      {/* Primary Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setTryOpen(true)}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors shadow-sm"
        >
          <TerminalIcon className="size-4" />
          <span>Try Live Demo</span>
        </button>

        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-dune px-4 py-3 text-sm font-semibold text-ink hover:bg-border/50 transition-colors"
        >
          <ShareIcon className="size-4" />
          <span>Share</span>
        </button>
      </div>

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
