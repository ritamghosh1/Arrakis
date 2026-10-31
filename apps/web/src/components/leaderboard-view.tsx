"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  LeaderboardPeriod,
  LeaderboardResponse,
  LeaderboardRow,
  LeaderboardType,
} from "@arrakis/contracts";
import { cn, compact, VIEWER_ID } from "@/lib/utils";
import { IconArrowUp, IconCheck, IconClose, IconSpark, IconTrophy } from "./icons";

function DeltaPill({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span
        className="bg-sage/15 text-sage inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums"
        title={`Moved up ${delta} positions`}
      >
        ▲ +{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span
        className="bg-alert/15 text-alert inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums"
        title={`Moved down ${Math.abs(delta)} positions`}
      >
        ▼ {delta}
      </span>
    );
  }
  return (
    <span className="bg-paper-sunken text-ink-muted inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold">
      — 0
    </span>
  );
}

export function LeaderboardView({ initial }: { initial: LeaderboardResponse }) {
  const [boardType, setBoardType] = useState<LeaderboardType>(initial.type);
  const [period, setPeriod] = useState<LeaderboardPeriod>(initial.period);
  const [data, setData] = useState<LeaderboardResponse>(initial);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<LeaderboardRow | null>(null);

  const breakdownDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = breakdownDialogRef.current;
    if (!d) return;
    if (selectedRow && !d.open) d.showModal();
    if (!selectedRow && d.open) d.close();
  }, [selectedRow]);

  async function changeBoard(nextType: LeaderboardType, nextPeriod: LeaderboardPeriod) {
    setBoardType(nextType);
    setPeriod(nextPeriod);
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        type: nextType,
        period: nextPeriod,
        userId: VIEWER_ID,
      });
      const res = await fetch(`/api/leaderboard?${qs}`);
      if (res.ok) {
        const json = (await res.json()) as LeaderboardResponse;
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }

  const podium = data.rows.slice(0, 3);
  const scoreUnit =
    boardType === "testers"
      ? "Scout XP"
      : boardType === "useful"
        ? "Usability S_use"
        : boardType === "popular"
          ? "Popularity S_pop"
          : boardType === "trending"
            ? "Trial Score"
            : "Builder Score";

  return (
    <div className="relative h-full overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 pt-5 pb-24">
        {/* Header & Anti-Clout Formula Banner */}
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-ink-muted font-mono text-xs font-semibold uppercase">
                Proof-of-Trial Ranking Engine · Anti-Clout Formula
              </p>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">Leaderboard</h1>
            </div>
            <span
              aria-live="polite"
              className="border-line bg-paper-raised rounded-full border px-3 py-1 font-mono text-xs font-semibold"
            >
              {loading ? "Recomputing ZSET…" : "● Live Redis ZSET Rollup"}
            </span>
          </div>

          <div className="border-line bg-paper-raised flex flex-col gap-2 rounded-2xl border p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-pretty">
              <strong className="font-bold">How Proof-of-Trial works:</strong> Upvotes from users
              who actually ran the sandbox count <strong className="text-primary font-mono">3×</strong>{" "}
              more than passive viewers (<span className="font-mono">1×</span>), multiplied by live
              container uptime (<span className="text-sage font-mono">≥85%</span>) and trial
              conversion rate.
            </p>
            <code className="bg-paper-sunken text-ink shrink-0 rounded-xl px-3 py-1.5 font-mono text-[11px] font-semibold">
              Score = ln(1 + 3·V_trial + V_pass) · Q_uptime
            </code>
          </div>
        </header>

        {/* Controls: Board Type + Time Period */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Leaderboard category"
            className="border-line bg-paper-sunken flex rounded-2xl border p-1"
          >
            {(
              [
                ["builders", "Top Builders"],
                ["testers", "Top Scouts"],
                ["trending", "Trending"],
                ["useful", "Most Useful"],
                ["popular", "Most Popular"],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={boardType === t}
                onClick={() => void changeBoard(t, period)}
                className={cn(
                  "rounded-xl px-3.5 py-2 text-xs font-bold transition-colors",
                  boardType === t ? "bg-ink text-paper shadow-xs" : "text-ink-muted hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="Leaderboard time window"
            className="border-line bg-paper-raised flex rounded-full border p-0.5 font-mono text-xs font-semibold"
          >
            {(
              [
                ["24h", "24h"],
                ["7d", "7d"],
                ["all", "All-Time"],
              ] as const
            ).map(([p, label]) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => void changeBoard(boardType, p)}
                className={cn(
                  "rounded-full px-3 py-1 transition-colors",
                  period === p ? "bg-primary text-primary-ink" : "text-ink-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Top 3 Podium */}
        <section aria-label="Top 3 podium" className="grid gap-3 sm:grid-cols-3">
          {podium.map((row) => {
            const title =
              row.entityType === "post"
                ? row.post?.title ?? "Tool"
                : row.user?.displayName ?? "Builder";
            const handle =
              row.entityType === "post" ? row.post?.author.handle : row.user?.handle;
            const avatar =
              row.entityType === "post" ? row.post?.author.avatarUrl : row.user?.avatarUrl;
            const href =
              row.entityType === "post"
                ? `/p/${row.post?.id}`
                : `/u/${row.user?.handle ?? "ritam"}`;

            return (
              <article
                key={row.rank}
                className={cn(
                  "border-line bg-paper-raised flex flex-col justify-between gap-3 rounded-[var(--radius-card)] border p-4",
                  row.rank === 1 && "border-primary border-2 shadow-sm",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs font-bold",
                      row.rank === 1
                        ? "bg-primary text-primary-ink"
                        : "bg-paper-sunken text-ink",
                    )}
                  >
                    <IconTrophy className="size-3.5" />#{row.rank}
                  </span>
                  <DeltaPill delta={row.delta} />
                </div>

                <Link href={href} className="flex items-center gap-3">
                  {avatar && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatar}
                      alt=""
                      width={44}
                      height={44}
                      className="border-sage bg-paper-sunken size-11 shrink-0 rounded-full border-2"
                    />
                  )}
                  <div className="min-w-0">
                    <h2 className="font-display truncate text-base font-bold hover:underline">
                      {title}
                    </h2>
                    <p className="text-ink-muted truncate font-mono text-xs">
                      @{handle} · {row.breakdown.uptimePct}% uptime
                    </p>
                  </div>
                </Link>

                <div className="border-line flex items-end justify-between border-t pt-2.5">
                  <div>
                    <span className="text-ink-muted block font-mono text-[10px] uppercase">
                      {scoreUnit}
                    </span>
                    <span className="font-display text-2xl font-bold tabular-nums">
                      {row.score.toLocaleString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRow(row)}
                    className="border-line bg-paper hover:bg-paper-sunken rounded-full border px-3 py-1 font-mono text-[11px] font-semibold"
                  >
                    Why #{row.rank}?
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        {/* Ranked List */}
        <section
          aria-label="Ranked leaderboard standings"
          className="border-line bg-paper-raised overflow-hidden rounded-[var(--radius-card)] border"
        >
          <ul className="divide-line divide-y">
            {data.rows.map((row) => {
              const isMe = row.user?.id === VIEWER_ID;
              const title =
                row.entityType === "post"
                  ? row.post?.title ?? "Tool"
                  : row.user?.displayName ?? "Builder";
              const handle =
                row.entityType === "post" ? row.post?.author.handle : row.user?.handle;
              const avatar =
                row.entityType === "post" ? row.post?.author.avatarUrl : row.user?.avatarUrl;
              const href =
                row.entityType === "post"
                  ? `/p/${row.post?.id}`
                  : `/u/${row.user?.handle ?? "ritam"}`;

              return (
                <li
                  key={`${row.rank}-${handle}-${title}`}
                  className={cn(
                    "cv-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3.5",
                    isMe && "bg-paper",
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="w-7 text-center font-mono text-sm font-bold tabular-nums">
                      #{row.rank}
                    </span>
                    <DeltaPill delta={row.delta} />
                    {avatar && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatar}
                        alt=""
                        width={36}
                        height={36}
                        className="bg-paper-sunken size-9 shrink-0 rounded-full"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={href}
                          className="font-display truncate text-sm font-bold hover:underline"
                        >
                          {title}
                        </Link>
                        {row.user?.verifiedUtility && (
                          <span
                            className="bg-sage text-primary-ink grid size-4 shrink-0 place-items-center rounded-full"
                            title="Verified Utility"
                          >
                            <IconCheck className="size-2.5" strokeWidth={3} />
                          </span>
                        )}
                        {isMe && (
                          <span className="bg-ink text-paper rounded-full px-2 py-0.5 font-mono text-[10px] font-bold">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-ink-muted truncate font-mono text-[11px]">
                        @{handle} · {row.breakdown.formulaSummary}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right font-mono tabular-nums">
                      <span className="block text-sm font-bold">
                        {row.score.toLocaleString()}
                      </span>
                      <span className="text-ink-muted block text-[10px]">{scoreUnit}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRow(row)}
                      aria-label={`View score breakdown for rank ${row.rank}`}
                      className="border-line bg-paper hover:bg-paper-sunken rounded-xl border px-3 py-1.5 font-mono text-xs font-semibold"
                    >
                      Breakdown
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Pinned "Your Standing" Bar */}
      {data.me && (
        <aside
          aria-label="Your current rank"
          className="border-line bg-ink text-paper fixed inset-x-0 bottom-14 z-nav border-t px-4 py-2.5 lg:bottom-0 lg:left-[16.5rem]"
        >
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="bg-primary text-primary-ink rounded-full px-2.5 py-0.5 font-mono text-xs font-bold">
                Your Rank: #{data.me.rank}
              </span>
              <span className="font-display text-sm font-bold">
                {data.me.user?.displayName} (@{data.me.user?.handle})
              </span>
              <DeltaPill delta={data.me.delta} />
            </div>
            <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
              <span>
                Score: <strong>{data.me.score.toLocaleString()}</strong>
              </span>
              <Link
                href="/u/ritam"
                className="bg-paper text-ink rounded-full px-3 py-1 font-sans text-xs font-bold"
              >
                Open Studio
              </Link>
            </div>
          </div>
        </aside>
      )}

      {/* Proof-of-Trial Breakdown Modal */}
      <dialog
        ref={breakdownDialogRef}
        className="sheet"
        aria-labelledby="breakdown-title"
        {...({ closedby: "any" } as Record<string, string>)}
        onClose={() => setSelectedRow(null)}
      >
        {selectedRow && (
          <div className="flex flex-col">
            <header className="border-line flex items-start justify-between gap-3 border-b p-4">
              <div>
                <p className="text-ink-muted font-mono text-[11px] font-semibold uppercase">
                  Proof-of-Trial Anti-Clout Audit · Rank #{selectedRow.rank}
                </p>
                <h2 id="breakdown-title" className="font-display text-lg font-bold">
                  {selectedRow.entityType === "post"
                    ? selectedRow.post?.title
                    : selectedRow.user?.displayName}
                </h2>
              </div>
              <form method="dialog">
                <button
                  aria-label="Close breakdown"
                  className="bg-paper-sunken grid size-9 place-items-center rounded-full"
                  autoFocus
                >
                  <IconClose className="size-5" />
                </button>
              </form>
            </header>

            <div className="space-y-4 p-4">
              <p className="text-ink-muted text-xs leading-relaxed">
                {selectedRow.breakdown.formulaSummary}
              </p>

              <dl className="grid grid-cols-2 gap-2.5 font-mono text-xs tabular-nums sm:grid-cols-3">
                <div className="border-line bg-paper rounded-xl border p-3">
                  <dt className="text-ink-muted text-[10px] uppercase">3× Trial Upvotes</dt>
                  <dd className="text-sage mt-0.5 text-lg font-bold">
                    {selectedRow.breakdown.trialUpvotes3x} (×3)
                  </dd>
                </div>
                <div className="border-line bg-paper rounded-xl border p-3">
                  <dt className="text-ink-muted text-[10px] uppercase">1× Passive Upvotes</dt>
                  <dd className="mt-0.5 text-lg font-bold">
                    {selectedRow.breakdown.passiveUpvotes} (×1)
                  </dd>
                </div>
                <div className="border-line bg-paper rounded-xl border p-3">
                  <dt className="text-ink-muted text-[10px] uppercase">Weighted Votes</dt>
                  <dd className="mt-0.5 text-lg font-bold">
                    {selectedRow.breakdown.weightedVotes}
                  </dd>
                </div>
                <div className="border-line bg-paper rounded-xl border p-3">
                  <dt className="text-ink-muted text-[10px] uppercase">Trial Conversion</dt>
                  <dd className="mt-0.5 text-lg font-bold">
                    {Math.round(selectedRow.breakdown.trialConversionRate * 100)}%
                  </dd>
                </div>
                <div className="border-line bg-paper rounded-xl border p-3">
                  <dt className="text-ink-muted text-[10px] uppercase">Worked Rate</dt>
                  <dd className="text-sage mt-0.5 text-lg font-bold">
                    {Math.round(selectedRow.breakdown.workedRate * 100)}%
                  </dd>
                </div>
                <div className="border-line bg-paper rounded-xl border p-3">
                  <dt className="text-ink-muted text-[10px] uppercase">Live Uptime</dt>
                  <dd className="text-sage mt-0.5 text-lg font-bold">
                    {selectedRow.breakdown.uptimePct}%
                  </dd>
                </div>
              </dl>

              <div className="border-line bg-paper-sunken/70 flex items-center justify-between rounded-xl border p-3 font-mono text-xs">
                <span className="flex items-center gap-1.5 font-semibold">
                  <IconSpark className="size-4" />
                  Final Proof-of-Trial Score
                </span>
                <span className="text-base font-bold">
                  {selectedRow.score.toLocaleString()} {scoreUnit}
                </span>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
