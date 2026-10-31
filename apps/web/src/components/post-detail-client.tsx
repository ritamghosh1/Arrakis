"use client";

import { useState } from "react";
import type { Post } from "@arrakis/contracts";
import { ShareSheet } from "./share-sheet";
import { TrySheet } from "./try-sheet";
import { IconBolt, IconShare } from "./icons";

export function PostDetailClient({ post }: { post: Post }) {
  const [tryOpen, setTryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [comments, setComments] = useState([
    {
      id: "c1",
      author: "devika",
      badge: "First-25 Scout",
      text: "Tested in container sandbox — parsed a 3-page two-column LaTeX resume in 138ms with zero schema errors.",
      ts: "2h ago",
    },
    {
      id: "c2",
      author: "srinjoy",
      badge: "Verified Builder",
      text: "Great cold-start latency. Suggest adding an optional flag for ISO-8601 date normalization.",
      ts: "5h ago",
    },
  ]);
  const [draft, setDraft] = useState("");

  function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setComments((prev) => [
      {
        id: `c_${Date.now()}`,
        author: "ritam",
        badge: "Scout · 3× Voter",
        text: draft.trim(),
        ts: "Just now",
      },
      ...prev,
    ]);
    setDraft("");
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setTryOpen(true)}
          className="bg-primary text-primary-ink flex h-11 flex-1 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold shadow-xs"
        >
          <IconBolt className="size-4" />
          Launch 1-Tap Sandbox
        </button>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="border-line bg-paper-raised hover:bg-paper-sunken flex h-11 items-center gap-2 rounded-full border px-5 text-xs font-bold"
        >
          <IconShare className="size-4" />
          Share & QR
        </button>
      </div>

      <section id="comments" aria-label="Direct feedback loop" className="space-y-3 pt-2">
        <h2 className="font-display text-lg font-bold">
          Direct Builder Feedback Loop ({comments.length})
        </h2>

        <form onSubmit={submitComment} className="flex gap-2">
          <label htmlFor="new-comment" className="sr-only">
            Add structured feedback or feature request
          </label>
          <input
            id="new-comment"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Suggest a feature or report an edge case directly to the builder…"
            className="border-line bg-paper-raised flex-1 rounded-xl border px-3.5 py-2 text-xs"
          />
          <button
            type="submit"
            className="bg-ink text-paper shrink-0 rounded-xl px-4 py-2 text-xs font-bold"
          >
            Post Feedback
          </button>
        </form>

        <ul className="space-y-2.5">
          {comments.map((c) => (
            <li key={c.id} className="border-line bg-paper-raised rounded-2xl border p-3.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">@{c.author}</span>
                  <span className="bg-paper-sunken rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold">
                    {c.badge}
                  </span>
                </div>
                <span className="text-ink-muted font-mono text-[11px]">{c.ts}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed">{c.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <TrySheet post={tryOpen ? post : null} onClose={() => setTryOpen(false)} />
      <ShareSheet post={shareOpen ? post : null} onClose={() => setShareOpen(false)} />
    </>
  );
}
