"use client";

import type {
  LeaderboardPeriod,
  LeaderboardResponse,
  LeaderboardRow,
  LeaderboardType,
} from "@arrakis/contracts";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  CheckCircleIcon,
  CloseIcon,
  SparklesIcon,
  TrophyIcon,
  VerifiedIcon,
} from "./icons";
import { cn, compact } from "@/lib/utils";

interface LeaderboardViewProps {
  initialData: LeaderboardResponse;
}

const TABS: { id: LeaderboardType; label: string; subtitle: string }[] = [
  { id: "builders", label: "Top Builders", subtitle: "Makers shipping reliable tools" },
  { id: "testers", label: "Top Scouts", subtitle: "Members testing & reviewing builds" },
  { id: "trending", label: "Trending Builds", subtitle: "Most tested projects this week" },
  { id: "useful", label: "Most Useful", subtitle: "Highest hands-on community rating" },
  { id: "popular", label: "Most Popular", subtitle: "Most shared and bookmarked builds" },
];

const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: "24h", label: "Today" },
  { id: "7d", label: "This Week" },
  { id: "all", label: "All Time" },
];

export function LeaderboardView({ initialData }: LeaderboardViewProps) {
  const [type, setType] = useState<LeaderboardType>(initialData.type);
  const [period, setPeriod] = useState<LeaderboardPeriod>(initialData.period);
  const [data, setData] = useState<LeaderboardResponse>(initialData);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<LeaderboardRow | null>(null);

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const dialogTitleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selectedRow) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [selectedRow]);

  async function loadBoard(nextType: LeaderboardType, nextPeriod: LeaderboardPeriod) {
    setType(nextType);
    setPeriod(nextPeriod);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/leaderboard?type=${encodeURIComponent(nextType)}&period=${encodeURIComponent(nextPeriod)}`
      );
      if (res.ok) {
        const nextData = (await res.json()) as LeaderboardResponse;
        setData(nextData);
      }
    } finally {
      setLoading(false);
    }
  }

  const podium = data.rows.slice(0, 3);

  return (
    <div className="mx-auto max-w-[1040px] px-4 sm:px-6 py-6 lg:py-9 pb-28 space-y-7">
      {/* Editorial Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
            <TrophyIcon className="size-3.5" />
            <span>Community Standings</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Builders, Scouts & Trending Projects
          </h1>
          <p className="text-sm text-muted max-w-2xl">
            Ranked by hands-on community testing, live demo reliability, and constructive reviews.
          </p>
        </div>

        {/* Time Period Selector */}
        <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface p-1 self-start">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => loadBoard(type, p.id)}
              aria-pressed={period === p.id}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors",
                period === p.id ? "bg-ink text-dune shadow-sm" : "text-muted hover:text-ink"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* Category Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {TABS.map((tab) => {
          const active = type === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => loadBoard(tab.id, period)}
              aria-pressed={active}
              className={cn(
                "rounded-2xl border p-4 text-left transition-colors",
                active
                  ? "border-ink bg-ink text-dune shadow-sm"
                  : "border-border bg-surface text-ink hover:border-ink/40"
              )}
            >
              <span className="block font-display text-base font-bold">{tab.label}</span>
              <span
                className={cn(
                  "block text-xs mt-0.5",
                  active ? "text-dune/75" : "text-muted"
                )}
              >
                {tab.subtitle}
              </span>
            </button>
          );
        })}
      </div>

      {/* Top 3 Podium */}
      {podium.length > 0 && (
        <section aria-label="Top 3 Podium" className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {podium.map((row) => {
            const isPost = row.entityType === "post";
            const name = isPost ? row.post?.title : row.user?.displayName;
            const sub = isPost ? `@${row.post?.author.handle}` : `@${row.user?.handle}`;
            const href = isPost ? `/p/${row.post?.id}` : `/u/${row.user?.handle}`;
            const avatar = isPost ? row.post?.thumbUrl : row.user?.avatarUrl;
            const verified = isPost
              ? row.post?.health.verifiedUtility
              : row.user?.verifiedUtility;

            return (
              <div
                key={`${row.rank}-${name}`}
                className={cn(
                  "rounded-2xl border p-5 flex flex-col justify-between gap-4 bg-surface shadow-sm",
                  row.rank === 1 ? "border-accent ring-1 ring-accent/30" : "border-border"
                )}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-bold",
                        row.rank === 1
                          ? "bg-accent text-white"
                          : row.rank === 2
                          ? "bg-ink text-dune"
                          : "bg-dune text-ink border border-border"
                      )}
                    >
                      Rank #{row.rank}
                    </span>

                    {verified && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-sage-soft px-2 py-0.5 text-[11px] font-semibold text-sage">
                        <VerifiedIcon className="size-3.5" />
                        Verified
                      </span>
                    )}
                  </div>

                  <Link href={href} className="flex items-center gap-3 group">
                    {avatar && (
                      <img
                        src={avatar}
                        alt={name ?? ""}
                        className={cn(
                          "size-12 border border-border bg-dune object-cover shrink-0",
                          isPost ? "rounded-xl" : "rounded-full"
                        )}
                      />
                    )}
                    <div className="min-w-0">
                      <h2 className="font-display text-base font-bold text-ink group-hover:text-accent transition-colors truncate">
                        {name}
                      </h2>
                      <p className="text-xs text-muted truncate">{sub}</p>
                    </div>
                  </Link>

                  <p className="text-xs text-muted line-clamp-2">
                    {isPost ? row.post?.problemStatement : row.user?.bio}
                  </p>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted">{row.breakdown.formulaSummary}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedRow(row)}
                    className="text-xs font-semibold text-accent hover:underline shrink-0 ml-2"
                  >
                    Highlights
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Full Standings List */}
      <section
        aria-label="Full standings"
        aria-busy={loading}
        className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm"
      >
        <div className="divide-y divide-border">
          {data.rows.map((row) => {
            const isPost = row.entityType === "post";
            const name = isPost ? row.post?.title : row.user?.displayName;
            const sub = isPost
              ? `by @${row.post?.author.handle} · ${row.post?.category}`
              : `@${row.user?.handle}`;
            const href = isPost ? `/p/${row.post?.id}` : `/u/${row.user?.handle}`;
            const avatar = isPost ? row.post?.thumbUrl : row.user?.avatarUrl;
            const verified = isPost
              ? row.post?.health.verifiedUtility
              : row.user?.verifiedUtility;

            return (
              <div
                key={`${row.rank}-${name}`}
                className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 px-4 sm:px-6 py-4 hover:bg-dune/40 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <span className="w-7 text-center font-display text-sm font-bold text-muted shrink-0">
                    #{row.rank}
                  </span>

                  <Link href={href} className="flex items-center gap-3 min-w-0 flex-1 group">
                    {avatar && (
                      <img
                        src={avatar}
                        alt={name ?? ""}
                        className={cn(
                          "size-10 border border-border bg-dune object-cover shrink-0",
                          isPost ? "rounded-xl" : "rounded-full"
                        )}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-display text-sm sm:text-base font-bold text-ink group-hover:text-accent transition-colors truncate">
                          {name}
                        </span>
                        {verified && <VerifiedIcon className="size-4 text-sage shrink-0" />}
                      </div>
                      <p className="text-xs text-muted truncate">{sub}</p>
                    </div>
                  </Link>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="hidden md:inline-block text-xs text-muted">
                    {row.breakdown.formulaSummary}
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedRow(row)}
                    className="rounded-xl border border-border bg-dune px-3 py-1.5 text-xs font-semibold text-ink hover:bg-border/50 transition-colors"
                  >
                    Why #{row.rank}?
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pinned Your Standing Bar */}
      {data.me && (
        <div className="fixed bottom-16 lg:bottom-4 inset-x-4 lg:left-[288px] lg:right-8 z-nav mx-auto max-w-[1000px] rounded-2xl border border-ink bg-ink text-dune px-5 py-3.5 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-white">
              Your Rank #{data.me.rank}
            </span>
            <div>
              <p className="text-sm font-bold text-dune">
                {data.me.user?.displayName ?? "Ritam Ghosh"} (@
                {data.me.user?.handle ?? "ritam"})
              </p>
              <p className="text-xs text-dune/75">{data.me.breakdown.formulaSummary}</p>
            </div>
          </div>

          <Link
            href="/u/ritam"
            className="rounded-xl bg-dune px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface transition-colors"
          >
            Open My Profile →
          </Link>
        </div>
      )}

      {/* Clean Human-Readable "Why This Rank?" Modal */}
      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        onClose={() => setSelectedRow(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setSelectedRow(null);
        }}
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 z-sheet m-0 w-auto sm:w-full sm:max-w-[480px] rounded-2xl border border-border bg-surface text-ink p-6 shadow-2xl"
      >
        {selectedRow && (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-accent">
                  Standing Highlights · Rank #{selectedRow.rank}
                </span>
                <h3 id={dialogTitleId} className="font-display text-lg font-bold text-ink mt-0.5">
                  {selectedRow.entityType === "post"
                    ? selectedRow.post?.title
                    : selectedRow.user?.displayName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                aria-label="Close standing highlights"
                className="rounded-lg p-1.5 text-muted hover:bg-dune hover:text-ink"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="rounded-xl border border-border bg-dune/60 p-3.5 flex items-start gap-3">
                <CheckCircleIcon className="size-5 text-sage shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-ink">Verified Hands-On Testing</p>
                  <p className="text-xs text-muted mt-0.5">
                    Endorsed by {compact(selectedRow.breakdown.trialUpvotes3x)} builders who ran the
                    live demo before voting.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-dune/60 p-3.5 flex items-start gap-3">
                <SparklesIcon className="size-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-ink">Consistent Demo Reliability</p>
                  <p className="text-xs text-muted mt-0.5">
                    Live demo runs cleanly in the browser with positive community feedback.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-dune"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
