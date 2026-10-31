"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Post } from "@arrakis/contracts";
import { track } from "@/lib/events";
import { MODE_LABEL } from "./reel-card";
import { IconCheck, IconClose, IconShare } from "./icons";

/**
 * Deterministic 15x15 visual QR matrix from a URL string so testers can scan or inspect
 * a crisp SVG QR code with zero external network calls.
 */
function buildQrMatrix(text: string): boolean[][] {
  const size = 15;
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const border = r === 0 || r === 4 || c === 0 || c === 4;
        const center = r === 2 && c === 2;
        grid[r0 + r]![c0 + c] = border || center;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 5);
  drawFinder(size - 5, 0);

  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inFinder =
        (r < 6 && c < 6) || (r < 6 && c >= size - 6) || (r >= size - 6 && c < 6);
      if (inFinder) continue;
      const bit = ((hash >>> ((r * size + c) % 24)) ^ (r * 17 + c * 31)) & 1;
      grid[r]![c] = bit === 1;
    }
  }
  return grid;
}

export function ShareSheet({ post, onClose }: { post: Post | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [laptopEmail, setLaptopEmail] = useState("");
  const [handoffSent, setHandoffSent] = useState(false);

  const shareUrl = useMemo(() => {
    if (!post) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "https://arrakis.dev";
    return `${origin}/p/${post.id}?ref=ritam`;
  }, [post]);

  const qrMatrix = useMemo(() => buildQrMatrix(shareUrl || "arrakis"), [shareUrl]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (post && !d.open) {
      setCopied(false);
      setHandoffSent(false);
      d.showModal();
    }
    if (!post && d.open) d.close();
  }, [post]);

  async function copyLink() {
    if (!post) return;
    track("share", post.id, 0.4);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(true);
    }
  }

  async function nativeShare() {
    if (!post) return;
    track("share", post.id, 0.4);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: `Try "${post.title}" in 1 tap on Arrakis: ${post.problemStatement}`,
          url: shareUrl,
        });
      } catch {
        // user dismissed
      }
    } else {
      await copyLink();
    }
  }

  function handleSendToLaptop(e: React.FormEvent) {
    e.preventDefault();
    if (!post || !laptopEmail.trim()) return;
    track("share", post.id, 0.4);
    setHandoffSent(true);
  }

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="share-sheet-title"
      {...({ closedby: "any" } as Record<string, string>)}
      onClose={onClose}
    >
      {post && (
        <div className="flex flex-col">
          <header className="border-line flex items-start justify-between gap-3 border-b p-4">
            <div>
              <p className="text-ink-muted font-mono text-[11px] font-semibold uppercase">
                Share Utility Tool · +15 Scout XP on Referral Trial
              </p>
              <h2 id="share-sheet-title" className="font-display text-lg font-bold text-balance">
                {post.title}
              </h2>
            </div>
            <form method="dialog">
              <button
                aria-label="Close share dialog"
                className="bg-paper-sunken grid size-9 place-items-center rounded-full"
                autoFocus
              >
                <IconClose className="size-5" />
              </button>
            </form>
          </header>

          <div className="space-y-4 p-4">
            {/* Post summary + QR */}
            <div className="border-line bg-paper flex flex-col gap-4 rounded-2xl border p-3.5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 space-y-1.5">
                <span className="bg-paper-sunken text-ink inline-block rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold">
                  {MODE_LABEL[post.demo.mode]} · {post.health.uptimePct}% uptime
                </span>
                <p className="text-ink-muted text-xs leading-relaxed text-pretty">
                  {post.problemStatement}
                </p>
                <p className="text-ink font-mono text-[11px]">
                  Builder: <span className="font-semibold">@{post.author.handle}</span>
                </p>
              </div>

              <div className="border-line bg-paper-raised flex shrink-0 flex-col items-center gap-1 self-center rounded-xl border p-2.5">
                <svg
                  viewBox="0 0 15 15"
                  className="size-24"
                  role="img"
                  aria-label={`QR code for ${post.title}`}
                >
                  {qrMatrix.map((row, r) =>
                    row.map((cell, c) =>
                      cell ? (
                        <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#1B1612" />
                      ) : null,
                    ),
                  )}
                </svg>
                <span className="text-ink-muted font-mono text-[10px]">Scan to test</span>
              </div>
            </div>

            {/* Direct Link & Copy */}
            <div>
              <label htmlFor="share-url-input" className="text-xs font-semibold">
                Direct Sandbox Deep-Link (with Scout referral tag)
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="share-url-input"
                  type="url"
                  readOnly
                  value={shareUrl}
                  className="border-line bg-paper-sunken text-ink flex-1 rounded-xl border px-3 py-2 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="bg-ink text-paper flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
                >
                  {copied ? (
                    <>
                      <IconCheck className="size-4" />
                      Copied
                    </>
                  ) : (
                    "Copy link"
                  )}
                </button>
              </div>
            </div>

            {/* Mode C: 1-Tap Send to Laptop Handoff */}
            <form onSubmit={handleSendToLaptop} className="border-line rounded-2xl border p-3.5">
              <label htmlFor="laptop-email" className="block text-xs font-semibold">
                Send to Laptop (Mode C Desktop Handoff)
              </label>
              <p className="text-ink-muted mt-0.5 text-xs">
                Browsing on mobile? Email yourself a 1-tap launch link + CLI command (`{post.demo.sampleCommand ?? "npx arrakis try"}`).
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  id="laptop-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="ritam@university.edu"
                  value={laptopEmail}
                  onChange={(e) => setLaptopEmail(e.target.value)}
                  className="border-line bg-paper-raised flex-1 rounded-xl border px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="border-line bg-paper-sunken text-ink shrink-0 rounded-xl border px-3.5 py-2 text-xs font-semibold"
                >
                  {handoffSent ? "Sent ✓" : "Send link"}
                </button>
              </div>
              {handoffSent && (
                <p className="text-sage mt-1.5 font-mono text-[11px]" role="status">
                  Handoff link & CLI snippet dispatched to {laptopEmail}.
                </p>
              )}
            </form>

            <button
              type="button"
              onClick={() => void nativeShare()}
              className="bg-primary text-primary-ink flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-bold"
            >
              <IconShare className="size-4" />
              Share with a Tester
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
