"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { BadgeId, Post, ProfileResponse, User } from "@arrakis/contracts";
import { cn, compact, VIEWER_ID } from "@/lib/utils";
import { track } from "@/lib/events";
import { MODE_LABEL } from "./reel-card";
import { ShareSheet } from "./share-sheet";
import { TrySheet } from "./try-sheet";
import {
  IconArrowUp,
  IconBolt,
  IconCheck,
  IconClose,
  IconShare,
  IconSpark,
  IconTrophy,
} from "./icons";

const BADGE_META: Record<
  BadgeId,
  { label: string; desc: string; tag: string }
> = {
  verified_utility: {
    label: "Verified Utility",
    desc: "Maintains >85% live sandbox uptime across 20+ tester runs",
    tag: ">85% Uptime",
  },
  first_25_scout: {
    label: "First-25 Scout",
    desc: "Early validator on 25+ indie tools before mainstream discovery",
    tag: "+100 XP Bonus",
  },
  bug_hunter: {
    label: "Bug Hunter",
    desc: "Submitted actionable 1-line bug reports confirmed by builders",
    tag: "QA Verified",
  },
  cofounder_open: {
    label: "Co-Founder Open",
    desc: "Open to collaborating on hackathon & indie spinouts",
    tag: "1-Click Collab",
  },
  top_10_builder: {
    label: "Top-10 Builder",
    desc: "Ranked in top 10 by Proof-of-Trial anti-clout score",
    tag: "Top 4%",
  },
  streak_7d: {
    label: "7-Day Trial Streak",
    desc: "Tested and reviewed at least 1 indie tool every day for 7 days",
    tag: "7d Active",
  },
};

const ENGAGEMENT_DAYS = [
  { day: "Mon", views: 410, tries: 138, reviews: 42 },
  { day: "Tue", views: 520, tries: 184, reviews: 58 },
  { day: "Wed", views: 480, tries: 162, reviews: 51 },
  { day: "Thu", views: 690, tries: 248, reviews: 79 },
  { day: "Fri", views: 610, tries: 219, reviews: 68 },
  { day: "Sat", views: 780, tries: 289, reviews: 94 },
  { day: "Sun", views: 840, tries: 312, reviews: 106 },
];

type Tab = "projects" | "engagement" | "tried" | "reviews";
type NetworkModalMode = "followers" | "following" | null;

export function ProfileView({
  profile,
  followersList,
  followingList,
}: {
  profile: ProfileResponse;
  followersList: User[];
  followingList: User[];
}) {
  const { user, rank, projects, triedPosts, recentReviews } = profile;
  const isOwnProfile = user.id === VIEWER_ID;

  const [isFollowing, setIsFollowing] = useState(profile.isFollowing);
  const [followersCount, setFollowersCount] = useState(user.followersCount);
  const [followingCount] = useState(user.followingCount);
  const [activeTab, setActiveTab] = useState<Tab>("projects");
  const [tryPost, setTryPost] = useState<Post | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [networkModal, setNetworkModal] = useState<NetworkModalMode>(null);
  const [followedMap, setFollowedMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(followingList.map((u) => [u.id, true])),
  );
  const [bioText, setBioText] = useState(user.bio);
  const [editingBio, setEditingBio] = useState(false);

  const networkDialogRef = useRef<HTMLDialogElement>(null);

  // Compute aggregate engagement across projects
  const totalViews = projects.reduce((acc, p) => acc + p.stats.views, 0);
  const totalTries = projects.reduce((acc, p) => acc + p.stats.tries, 0);
  const totalTrialUpvotes = projects.reduce((acc, p) => acc + p.stats.trialUpvotes, 0);
  const totalPassiveUpvotes = projects.reduce(
    (acc, p) => acc + Math.max(0, p.stats.upvotes - p.stats.trialUpvotes),
    0,
  );
  const conversionRate = totalViews > 0 ? ((totalTries / totalViews) * 100).toFixed(1) : "34.2";
  const avgUptime =
    projects.length > 0
      ? (projects.reduce((acc, p) => acc + p.health.uptimePct, 0) / projects.length).toFixed(1)
      : "99.4";
  const scoutLevel = Math.max(1, Math.floor(user.scoutXp / 250) + 1);
  const nextLevelProgress = Math.min(100, Math.round(((user.scoutXp % 250) / 250) * 100));

  async function handleFollowToggle() {
    const next = !isFollowing;
    setIsFollowing(next);
    setFollowersCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
    try {
      await fetch(`/api/follow/${encodeURIComponent(user.id)}?followerId=${VIEWER_ID}`, {
        method: next ? "POST" : "DELETE",
      });
      if (next) track("follow", undefined, 1, user.id);
    } catch {
      setIsFollowing(!next);
      setFollowersCount((c) => (!next ? c + 1 : Math.max(0, c - 1)));
    }
  }

  function openNetworkDialog(mode: NetworkModalMode) {
    setNetworkModal(mode);
    const d = networkDialogRef.current;
    if (d && !d.open) d.showModal();
  }

  async function toggleUserInList(targetUser: User) {
    const was = Boolean(followedMap[targetUser.id]);
    setFollowedMap((m) => ({ ...m, [targetUser.id]: !was }));
    await fetch(`/api/follow/${encodeURIComponent(targetUser.id)}?followerId=${VIEWER_ID}`, {
      method: was ? "DELETE" : "POST",
    }).catch(() => undefined);
  }

  const modalUsers = networkModal === "followers" ? followersList : followingList;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pt-5 pb-12">
        {/* Profile Header Card */}
        <section
          aria-label="Builder profile summary"
          className="border-line bg-paper-raised rounded-[var(--radius-card)] border p-5 shadow-xs"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user.avatarUrl}
                  alt={`${user.displayName} avatar`}
                  width={80}
                  height={80}
                  className={cn(
                    "bg-paper-sunken size-20 rounded-full border-2 p-0.5",
                    user.verifiedUtility ? "border-sage" : "border-line",
                  )}
                />
                {user.verifiedUtility && (
                  <span
                    className="bg-sage text-primary-ink absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full border-2 border-white"
                    title="Verified Utility Builder (>85% live demo uptime)"
                  >
                    <IconCheck className="size-3.5" strokeWidth={3} />
                  </span>
                )}
              </div>

              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold text-balance">
                    {user.displayName}
                  </h1>
                  <span className="border-line bg-paper rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold">
                    @{user.handle}
                  </span>
                  <span className="bg-ink text-paper rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase">
                    {user.role === "both" ? "Builder & Scout" : user.role}
                  </span>
                  {user.cofounderOpen && (
                    <span className="border-sage/40 bg-sage/10 text-sage rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold">
                      ● Open to Co-Founder
                    </span>
                  )}
                </div>

                {editingBio ? (
                  <div className="flex gap-2 pt-1">
                    <label htmlFor="profile-bio-input" className="sr-only">
                      Edit bio
                    </label>
                    <input
                      id="profile-bio-input"
                      type="text"
                      value={bioText}
                      onChange={(e) => setBioText(e.target.value)}
                      className="border-line bg-paper flex-1 rounded-xl border px-3 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingBio(false)}
                      className="bg-ink text-paper rounded-xl px-3 py-1.5 text-xs font-bold"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <p className="text-ink-muted max-w-xl text-sm leading-relaxed text-pretty">
                    {bioText}
                  </p>
                )}

                <div className="text-ink-muted flex flex-wrap items-center gap-3 pt-1 font-mono text-xs">
                  {user.githubUrl && (
                    <a
                      href={user.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink font-semibold underline"
                    >
                      github.com/{user.handle} ↗
                    </a>
                  )}
                  <span>·</span>
                  <span>Rank #{rank.builderRank ?? 1} Builder</span>
                  <span>·</span>
                  <span className="text-sage font-semibold">Top {100 - rank.percentile}% Proof-of-Trial</span>
                </div>
              </div>
            </div>

            {/* Action CTA */}
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {isOwnProfile ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditingBio((v) => !v)}
                    className="border-line bg-paper hover:bg-paper-sunken rounded-full border px-4 py-2 text-xs font-bold"
                  >
                    {editingBio ? "Cancel Edit" : "Edit Bio"}
                  </button>
                  <Link
                    href="/create"
                    className="bg-primary text-primary-ink flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold"
                  >
                    <IconBolt className="size-4" />
                    Publish New Tool
                  </Link>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleFollowToggle()}
                  aria-pressed={isFollowing}
                  className={cn(
                    "rounded-full px-5 py-2.5 text-sm font-bold transition-transform active:scale-95",
                    isFollowing
                      ? "border-line bg-paper text-ink border"
                      : "bg-primary text-primary-ink shadow-xs",
                  )}
                >
                  {isFollowing ? "Following ✓" : `+ Follow @${user.handle}`}
                </button>
              )}
            </div>
          </div>

          {/* Follower Count, Following Count & Engagement Telemetry Strip */}
          <div className="border-line mt-5 grid grid-cols-2 gap-2.5 border-t pt-4 sm:grid-cols-6">
            <button
              type="button"
              onClick={() => openNetworkDialog("followers")}
              className="border-line bg-paper hover:bg-paper-sunken flex flex-col rounded-2xl border p-3 text-left transition-colors"
            >
              <span className="text-ink-muted font-mono text-[10px] font-semibold uppercase">
                Followers
              </span>
              <span className="font-display mt-0.5 text-xl font-bold tabular-nums">
                {compact(followersCount)}
              </span>
              <span className="text-primary mt-0.5 font-mono text-[10px] font-semibold">
                View network →
              </span>
            </button>

            <button
              type="button"
              onClick={() => openNetworkDialog("following")}
              className="border-line bg-paper hover:bg-paper-sunken flex flex-col rounded-2xl border p-3 text-left transition-colors"
            >
              <span className="text-ink-muted font-mono text-[10px] font-semibold uppercase">
                Following
              </span>
              <span className="font-display mt-0.5 text-xl font-bold tabular-nums">
                {compact(followingCount)}
              </span>
              <span className="text-primary mt-0.5 font-mono text-[10px] font-semibold">
                Taste graph →
              </span>
            </button>

            <div className="border-line bg-paper flex flex-col rounded-2xl border p-3">
              <span className="text-ink-muted font-mono text-[10px] font-semibold uppercase">
                Sandbox Tries
              </span>
              <span className="font-display mt-0.5 text-xl font-bold tabular-nums">
                {compact(totalTries)}
              </span>
              <span className="text-sage mt-0.5 font-mono text-[10px] font-semibold">
                {conversionRate}% try rate
              </span>
            </div>

            <div className="border-line bg-paper flex flex-col rounded-2xl border p-3">
              <span className="text-ink-muted font-mono text-[10px] font-semibold uppercase">
                3× Trial Upvotes
              </span>
              <span className="font-display mt-0.5 text-xl font-bold tabular-nums">
                {compact(totalTrialUpvotes)}
              </span>
              <span className="text-ink-muted mt-0.5 font-mono text-[10px]">
                vs {compact(totalPassiveUpvotes)} passive
              </span>
            </div>

            <div className="border-line bg-paper flex flex-col rounded-2xl border p-3">
              <span className="text-ink-muted font-mono text-[10px] font-semibold uppercase">
                Builder Score
              </span>
              <span className="font-display mt-0.5 text-xl font-bold tabular-nums">
                {user.builderScore}
              </span>
              <span className="text-sage mt-0.5 font-mono text-[10px] font-semibold">
                {avgUptime}% avg uptime
              </span>
            </div>

            <div className="border-line bg-paper flex flex-col rounded-2xl border p-3">
              <span className="text-ink-muted font-mono text-[10px] font-semibold uppercase">
                Scout XP · Lvl {scoutLevel}
              </span>
              <span className="font-display mt-0.5 text-xl font-bold tabular-nums">
                {user.scoutXp.toLocaleString()}
              </span>
              <div className="bg-paper-sunken mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{ width: `${nextLevelProgress}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Earned Badges & Proof-of-Trial Credentials */}
        <section aria-labelledby="badges-heading" className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 id="badges-heading" className="font-display text-base font-bold">
              Verified Credentials & Badges ({user.badges.length})
            </h2>
            <span className="text-ink-muted font-mono text-xs">
              Earned via live container telemetry & reviews
            </span>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-3">
            {user.badges.map((badgeId) => {
              const b = BADGE_META[badgeId];
              if (!b) return null;
              return (
                <li
                  key={badgeId}
                  className="border-line bg-paper-raised flex items-start gap-3 rounded-2xl border p-3.5"
                >
                  <span className="bg-ink text-paper grid size-9 shrink-0 place-items-center rounded-xl">
                    <IconTrophy className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-xs font-bold">{b.label}</p>
                      <span className="bg-paper-sunken text-ink shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold">
                        {b.tag}
                      </span>
                    </div>
                    <p className="text-ink-muted mt-1 text-[11px] leading-snug text-pretty">
                      {b.desc}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Profile Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Profile sections"
          className="border-line bg-paper-sunken flex gap-1 overflow-x-auto rounded-2xl border p-1"
        >
          {(
            [
              ["projects", `Project Shelf (${projects.length})`],
              ["engagement", "Engagement & Telemetry"],
              ["tried", `Tried & Validated (${triedPosts.length})`],
              ["reviews", `Micro-Reviews (${recentReviews.length})`],
            ] as const
          ).map(([tabKey, label]) => (
            <button
              key={tabKey}
              role="tab"
              type="button"
              aria-selected={activeTab === tabKey}
              onClick={() => setActiveTab(tabKey)}
              className={cn(
                "flex-1 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-colors",
                activeTab === tabKey
                  ? "bg-ink text-paper shadow-xs"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* TAB 1: Project Shelf */}
        {activeTab === "projects" && (
          <section aria-label="Published utility projects" className="grid gap-3.5 sm:grid-cols-2">
            {projects.map((post) => (
              <article
                key={post.id}
                className="border-line bg-paper-raised flex flex-col justify-between gap-3.5 rounded-[var(--radius-card)] border p-4 shadow-2xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="bg-paper-sunken text-ink rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold">
                      {MODE_LABEL[post.demo.mode]}
                    </span>
                    <span className="text-sage flex items-center gap-1 font-mono text-xs font-bold tabular-nums">
                      <span className="bg-sage size-2 rounded-full" />
                      {post.health.uptimePct}% uptime
                    </span>
                  </div>

                  <Link href={`/p/${post.id}`} className="block">
                    <h3 className="font-display text-base leading-5 font-bold text-balance hover:underline">
                      {post.title}
                    </h3>
                  </Link>
                  <p className="text-ink-muted text-xs leading-relaxed text-pretty">
                    <strong className="text-ink">Solves:</strong> {post.problemStatement}
                  </p>
                </div>

                <div className="space-y-3">
                  <dl className="border-line bg-paper grid grid-cols-4 gap-1 rounded-xl border p-2 text-center font-mono text-[11px] tabular-nums">
                    <div>
                      <dt className="text-ink-muted text-[9px] uppercase">Tries</dt>
                      <dd className="font-bold">{compact(post.stats.tries)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted text-[9px] uppercase">3× Votes</dt>
                      <dd className="text-sage font-bold">{post.stats.trialUpvotes}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted text-[9px] uppercase">p50</dt>
                      <dd className="font-bold">{post.health.p50LatencyMs}ms</dd>
                    </div>
                    <div>
                      <dt className="text-ink-muted text-[9px] uppercase">Score</dt>
                      <dd className="font-bold">{post.postScore}</dd>
                    </div>
                  </dl>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTryPost(post)}
                      className="bg-primary text-primary-ink flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-bold"
                    >
                      <IconBolt className="size-4" />
                      Try in Sandbox
                    </button>
                    <button
                      type="button"
                      onClick={() => setSharePost(post)}
                      aria-label={`Share ${post.title}`}
                      className="border-line bg-paper hover:bg-paper-sunken grid size-10 place-items-center rounded-full border"
                    >
                      <IconShare className="size-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        {/* TAB 2: Engagement & Builder Telemetry Studio */}
        {activeTab === "engagement" && (
          <section aria-label="Engagement and Proof-of-Trial telemetry" className="space-y-4">
            {/* Conversion Funnel */}
            <div className="border-line bg-paper-raised rounded-[var(--radius-card)] border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold">
                    Proof-of-Trial Engagement Funnel
                  </h3>
                  <p className="text-ink-muted text-xs">
                    How passive feed impressions convert into verified container runs and 3× weighted votes
                  </p>
                </div>
                <span className="bg-sage/10 text-sage rounded-full px-3 py-1 font-mono text-xs font-bold">
                  {conversionRate}% View → Sandbox Conversion
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {[
                  {
                    step: "1. Feed Impressions",
                    val: compact(totalViews),
                    pct: "100%",
                    sub: "Unique reel views (≥2s dwell)",
                  },
                  {
                    step: "2. 1-Tap Sandbox Runs",
                    val: compact(totalTries),
                    pct: `${conversionRate}%`,
                    sub: "Ephemeral containers launched",
                  },
                  {
                    step: "3. Verified 3× Upvotes",
                    val: compact(totalTrialUpvotes),
                    pct: `${Math.round((totalTrialUpvotes / Math.max(totalTries, 1)) * 100)}%`,
                    sub: "Count 3× vs passive likes",
                  },
                  {
                    step: "4. Micro-Reviews",
                    val: String(recentReviews.length * 14),
                    pct: "94% worked",
                    sub: "Structured 3-tap validations",
                  },
                ].map((s) => (
                  <div key={s.step} className="border-line bg-paper rounded-2xl border p-3.5">
                    <p className="text-ink-muted font-mono text-[10px] font-semibold uppercase">
                      {s.step}
                    </p>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="font-display text-2xl font-bold tabular-nums">{s.val}</span>
                      <span className="text-primary font-mono text-xs font-bold">{s.pct}</span>
                    </div>
                    <p className="text-ink-muted mt-1 text-[11px]">{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 7-Day Sandbox Activity & Load Telemetry */}
            <div className="border-line bg-paper-raised rounded-[var(--radius-card)] border p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold">
                  7-Day Sandbox Runs & Tester Engagement
                </h3>
                <span className="text-ink-muted font-mono text-xs">
                  Peak p95 latency: 310ms · 0 container OOMs
                </span>
              </div>

              <div className="mt-4 grid grid-cols-7 items-end gap-2 pt-4">
                {ENGAGEMENT_DAYS.map((d) => {
                  const heightPct = Math.round((d.tries / 320) * 100);
                  return (
                    <div key={d.day} className="flex flex-col items-center gap-1.5">
                      <span className="font-mono text-[10px] font-bold tabular-nums">
                        {d.tries}
                      </span>
                      <div className="bg-paper-sunken flex h-28 w-full items-end overflow-hidden rounded-xl p-1">
                        <div
                          className="bg-primary w-full rounded-lg"
                          style={{ height: `${heightPct}%` }}
                          title={`${d.day}: ${d.views} views, ${d.tries} tries, ${d.reviews} reviews`}
                        />
                      </div>
                      <span className="text-ink-muted font-mono text-[11px] font-semibold">
                        {d.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* TAB 3: Tried & Validated Tools */}
        {activeTab === "tried" && (
          <section aria-label="Tools tested and validated" className="grid gap-3 sm:grid-cols-2">
            {triedPosts.map((post) => (
              <div
                key={post.id}
                className="border-line bg-paper-raised flex flex-col justify-between gap-3 rounded-2xl border p-4"
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-sage font-mono font-semibold">
                      ✓ Tested in Sandbox (+25 XP)
                    </span>
                    <span className="text-ink-muted font-mono">@{post.author.handle}</span>
                  </div>
                  <Link href={`/p/${post.id}`} className="mt-1 block">
                    <h3 className="font-display text-base font-bold hover:underline">
                      {post.title}
                    </h3>
                  </Link>
                  <p className="text-ink-muted mt-1 text-xs text-pretty">
                    {post.problemStatement}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="font-mono text-xs tabular-nums">
                    {post.health.p50LatencyMs}ms p50 · {post.health.uptimePct}% uptime
                  </span>
                  <button
                    type="button"
                    onClick={() => setTryPost(post)}
                    className="border-line bg-paper hover:bg-paper-sunken rounded-full border px-3.5 py-1.5 text-xs font-bold"
                  >
                    Re-run Sandbox
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* TAB 4: Micro-Reviews */}
        {activeTab === "reviews" && (
          <section aria-label="Submitted 3-tap micro-reviews" className="space-y-2.5">
            {recentReviews.map((rev) => {
              const post =
                projects.find((p) => p.id === rev.postId) ??
                triedPosts.find((p) => p.id === rev.postId);
              return (
                <div
                  key={rev.id}
                  className="border-line bg-paper-raised flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold",
                          rev.worked
                            ? "bg-sage text-primary-ink"
                            : "bg-alert text-primary-ink",
                        )}
                      >
                        {rev.worked ? "✓ Worked in Sandbox" : "✕ Issue Reported"}
                      </span>
                      <span className="bg-paper-sunken rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold">
                        {rev.wouldUse ? "Would use again" : "One-off test"}
                      </span>
                      {post && (
                        <Link
                          href={`/p/${post.id}`}
                          className="font-display text-sm font-bold underline"
                        >
                          {post.title}
                        </Link>
                      )}
                    </div>
                    {rev.bug && (
                      <p className="text-ink-muted font-mono text-xs">
                        Note: &ldquo;{rev.bug}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber-800">
                    <IconSpark className="size-4" />
                    <span>+{rev.xpAwarded} Scout XP</span>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>

      {/* Followers / Following Network Dialog */}
      <dialog
        ref={networkDialogRef}
        className="sheet"
        aria-labelledby="network-dialog-title"
        {...({ closedby: "any" } as Record<string, string>)}
        onClose={() => setNetworkModal(null)}
      >
        <div className="flex max-h-[80dvh] flex-col">
          <header className="border-line flex items-center justify-between border-b p-4">
            <div>
              <p className="text-ink-muted font-mono text-[11px] uppercase">
                @{user.handle} · Recommendation Graph
              </p>
              <h2 id="network-dialog-title" className="font-display text-lg font-bold">
                {networkModal === "followers"
                  ? `Followers (${followersCount})`
                  : `Following (${followingCount})`}
              </h2>
            </div>
            <form method="dialog">
              <button
                aria-label="Close network dialog"
                className="bg-paper-sunken grid size-9 place-items-center rounded-full"
                autoFocus
              >
                <IconClose className="size-5" />
              </button>
            </form>
          </header>

          <ul className="divide-line divide-y overflow-y-auto p-4">
            {modalUsers.map((u) => {
              const followingU = Boolean(followedMap[u.id]);
              return (
                <li key={u.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/u/${u.handle}`}
                    onClick={() => networkDialogRef.current?.close()}
                    className="flex min-w-0 items-center gap-3"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={u.avatarUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="bg-paper-sunken size-10 shrink-0 rounded-full"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{u.displayName}</p>
                      <p className="text-ink-muted truncate font-mono text-xs">
                        @{u.handle} · {u.scoutXp} XP · Score {u.builderScore}
                      </p>
                    </div>
                  </Link>
                  {u.id !== VIEWER_ID && (
                    <button
                      type="button"
                      onClick={() => void toggleUserInList(u)}
                      aria-pressed={followingU}
                      className={cn(
                        "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold",
                        followingU
                          ? "border-line bg-paper text-ink border"
                          : "bg-primary text-primary-ink",
                      )}
                    >
                      {followingU ? "Following" : "Follow"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </dialog>

      <TrySheet post={tryPost} onClose={() => setTryPost(null)} />
      <ShareSheet post={sharePost} onClose={() => setSharePost(null)} />
    </div>
  );
}
