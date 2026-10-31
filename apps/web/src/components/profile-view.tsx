"use client";

import type { BadgeId, Post, ProfileResponse, User } from "@arrakis/contracts";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  CheckCircleIcon,
  CloseIcon,
  ExternalLinkIcon,
  ShareIcon,
  SparklesIcon,
  TerminalIcon,
  VerifiedIcon,
} from "./icons";
import { ShareSheet } from "./share-sheet";
import { TrySheet } from "./try-sheet";
import { cn, compact } from "@/lib/utils";

interface ProfileViewProps {
  profile: ProfileResponse;
  followers: User[];
  following: User[];
}

const BADGE_INFO: Record<BadgeId, { label: string; description: string }> = {
  verified_utility: {
    label: "Verified Builder",
    description: "Ships reliable live demos tested by the community",
  },
  first_25_scout: {
    label: "Early Scout",
    description: "Discovers and tests new builds early",
  },
  bug_hunter: {
    label: "Helpful Reviewer",
    description: "Shares constructive feedback with builders",
  },
  cofounder_open: {
    label: "Open to Collaborate",
    description: "Available for hackathon or startup collaborations",
  },
  top_10_builder: {
    label: "Top Builder",
    description: "Featured in the community builder standings",
  },
  streak_7d: {
    label: "Active Member",
    description: "Consistently building and testing new tools",
  },
};

export function ProfileView({ profile, followers, following }: ProfileViewProps) {
  const [user, setUser] = useState<User>(profile.user);
  const [isFollowing, setIsFollowing] = useState<boolean>(profile.isFollowing);
  const [followerCount, setFollowerCount] = useState<number>(profile.user.followersCount);
  const [activeTab, setActiveTab] = useState<"projects" | "tried" | "reviews">("projects");
  const [networkModal, setNetworkModal] = useState<"followers" | "following" | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  // Edit profile form state
  const [editName, setEditName] = useState(profile.user.displayName);
  const [editBio, setEditBio] = useState(profile.user.bio);
  const [editGithub, setEditGithub] = useState(profile.user.githubUrl ?? "");
  const [editCofounder, setEditCofounder] = useState(profile.user.cofounderOpen);

  const [activeTryPost, setActiveTryPost] = useState<Post | null>(null);
  const [activeSharePost, setActiveSharePost] = useState<Post | null>(null);
  const [followedMap, setFollowedMap] = useState<Record<string, boolean>>({});

  const networkDialogRef = useRef<HTMLDialogElement | null>(null);
  const editDialogRef = useRef<HTMLDialogElement | null>(null);
  const networkDialogTitleId = useId();
  const editDialogTitleId = useId();

  const isOwnProfile = user.handle.toLowerCase() === "ritam" || user.id === "usr_ritam";

  useEffect(() => {
    const dialog = networkDialogRef.current;
    if (!dialog) return;
    if (networkModal) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [networkModal]);

  useEffect(() => {
    const dialog = editDialogRef.current;
    if (!dialog) return;
    if (editingProfile) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [editingProfile]);

  async function handleToggleMainFollow() {
    const next = !isFollowing;
    setIsFollowing(next);
    setFollowerCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
    try {
      await fetch(`/api/follow/${encodeURIComponent(user.id)}`, {
        method: next ? "POST" : "DELETE",
      });
    } catch {
      setIsFollowing(!next);
      setFollowerCount((c) => (!next ? c + 1 : Math.max(0, c - 1)));
    }
  }

  async function handleToggleListFollow(targetUserId: string) {
    const next = !followedMap[targetUserId];
    setFollowedMap((prev) => ({ ...prev, [targetUserId]: next }));
    try {
      await fetch(`/api/follow/${encodeURIComponent(targetUserId)}`, {
        method: next ? "POST" : "DELETE",
      });
    } catch {
      // Ignore offline error
    }
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setUser((prev) => ({
      ...prev,
      displayName: editName.trim() || prev.displayName,
      bio: editBio.trim() || prev.bio,
      githubUrl: editGithub.trim() || undefined,
      cofounderOpen: editCofounder,
    }));
    setEditingProfile(false);
  }

  const modalUsers = networkModal === "followers" ? followers : following;

  return (
    <div className="mx-auto max-w-[1040px] px-4 sm:px-6 py-6 lg:py-9 space-y-7">
      {/* Clean Profile Header Card */}
      <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          <div className="flex items-start gap-4 sm:gap-5">
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="size-20 sm:size-24 rounded-2xl border border-border bg-dune object-cover shrink-0"
            />
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {user.displayName}
                </h1>
                {user.verifiedUtility && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-sage-soft px-2.5 py-0.5 text-xs font-semibold text-sage">
                    <VerifiedIcon className="size-3.5" />
                    Verified Builder
                  </span>
                )}
                {user.cofounderOpen && (
                  <span className="rounded-md bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                    Open to Collaborate
                  </span>
                )}
              </div>

              <p className="text-sm font-medium text-muted">@{user.handle}</p>
              <p className="text-sm text-ink max-w-2xl leading-relaxed">{user.bio}</p>

              {user.githubUrl && (
                <div className="pt-1">
                  <a
                    href={user.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                  >
                    <span>GitHub Profile</span>
                    <ExternalLinkIcon className="size-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {isOwnProfile ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditingProfile(true)}
                  className="rounded-xl border border-border bg-dune px-4 py-2 text-xs font-semibold text-ink hover:bg-border/50 transition-colors"
                >
                  Edit Profile
                </button>
                <Link
                  href="/create"
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover transition-colors"
                >
                  + Publish Build
                </Link>
              </>
            ) : (
              <button
                type="button"
                onClick={handleToggleMainFollow}
                aria-pressed={isFollowing}
                className={cn(
                  "rounded-xl px-5 py-2.5 text-xs font-semibold transition-colors",
                  isFollowing
                    ? "border border-border bg-dune text-ink hover:bg-border/50"
                    : "bg-ink text-dune hover:bg-ink/90"
                )}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            )}
          </div>
        </div>

        {/* Clean Social & Activity Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => setNetworkModal("followers")}
            className="rounded-xl border border-border bg-dune/60 p-3.5 text-left hover:border-ink/40 transition-colors"
          >
            <span className="block font-display text-xl font-bold text-ink">
              {compact(followerCount)}
            </span>
            <span className="block text-xs text-muted mt-0.5">Followers · View list</span>
          </button>

          <button
            type="button"
            onClick={() => setNetworkModal("following")}
            className="rounded-xl border border-border bg-dune/60 p-3.5 text-left hover:border-ink/40 transition-colors"
          >
            <span className="block font-display text-xl font-bold text-ink">
              {compact(user.followingCount)}
            </span>
            <span className="block text-xs text-muted mt-0.5">Following · View list</span>
          </button>

          <div className="rounded-xl border border-border bg-dune/60 p-3.5">
            <span className="block font-display text-xl font-bold text-ink">
              {profile.projects.length}
            </span>
            <span className="block text-xs text-muted mt-0.5">Published Builds</span>
          </div>

          <div className="rounded-xl border border-border bg-dune/60 p-3.5">
            <span className="block font-display text-xl font-bold text-ink">
              {profile.triedPosts.length + profile.recentReviews.length}
            </span>
            <span className="block text-xs text-muted mt-0.5">Demos Tested & Reviewed</span>
          </div>
        </div>

        {/* Earned Badges Row */}
        {user.badges.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {user.badges.map((badgeId) => {
              const badge = BADGE_INFO[badgeId];
              if (!badge) return null;
              return (
                <div
                  key={badgeId}
                  title={badge.description}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink"
                >
                  <SparklesIcon className="size-3.5 text-accent" />
                  <span>{badge.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Clean Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {(
          [
            { id: "projects", label: `Projects (${profile.projects.length})` },
            { id: "tried", label: `Tried Demos (${profile.triedPosts.length})` },
            { id: "reviews", label: `Reviews (${profile.recentReviews.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            className={cn(
              "rounded-xl px-4 py-2 text-xs font-semibold transition-colors",
              activeTab === tab.id
                ? "bg-ink text-dune shadow-sm"
                : "bg-surface text-muted hover:text-ink border border-border"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PUBLISHED PROJECTS */}
      {activeTab === "projects" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {profile.projects.map((post) => (
            <article
              key={post.id}
              className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm flex flex-col justify-between"
            >
              <div>
                <Link href={`/p/${post.id}`} className="block relative aspect-[16/9] bg-ink">
                  <img
                    src={post.thumbUrl}
                    alt={post.title}
                    className="h-full w-full object-cover opacity-90 hover:opacity-100 transition-opacity"
                  />
                  <span className="absolute top-3 left-3 rounded-lg bg-ink/80 px-2.5 py-1 text-[11px] font-semibold text-dune">
                    {post.category}
                  </span>
                </Link>

                <div className="p-5 space-y-3">
                  <Link
                    href={`/p/${post.id}`}
                    className="block font-display text-lg font-bold text-ink hover:text-accent transition-colors"
                  >
                    {post.title}
                  </Link>
                  <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                    {post.problemStatement}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5 pt-3 border-t border-border flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTryPost(post)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white hover:bg-accent-hover transition-colors"
                >
                  <TerminalIcon className="size-3.5" />
                  <span>Try Live Demo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSharePost(post)}
                  aria-label={`Share ${post.title}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-dune px-3.5 py-2.5 text-xs font-semibold text-ink hover:bg-border/50 transition-colors"
                >
                  <ShareIcon className="size-3.5" />
                  <span>Share</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* TAB 2: TRIED DEMOS */}
      {activeTab === "tried" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {profile.triedPosts.map((post) => (
            <article
              key={post.id}
              className="rounded-2xl border border-border bg-surface p-5 flex flex-col justify-between gap-4 shadow-sm"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-sage-soft px-2.5 py-0.5 text-[11px] font-semibold text-sage">
                    Tested in Sandbox
                  </span>
                  <span className="text-xs text-muted">by @{post.author.handle}</span>
                </div>
                <Link
                  href={`/p/${post.id}`}
                  className="block font-display text-base font-bold text-ink hover:text-accent transition-colors"
                >
                  {post.title}
                </Link>
                <p className="text-xs text-muted line-clamp-2">{post.problemStatement}</p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setActiveTryPost(post)}
                  className="rounded-xl bg-ink px-3.5 py-2 text-xs font-semibold text-dune hover:bg-ink/90 transition-colors"
                >
                  Launch Again
                </button>
                <Link
                  href={`/p/${post.id}`}
                  className="rounded-xl border border-border bg-dune px-3.5 py-2 text-xs font-semibold text-ink"
                >
                  View Post
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* TAB 3: REVIEWS */}
      {activeTab === "reviews" && (
        <div className="space-y-3">
          {profile.recentReviews.map((rev) => {
            const post =
              profile.triedPosts.find((p) => p.id === rev.postId) ?? profile.projects[0];
            return (
              <div
                key={rev.id}
                className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-sage-soft px-2 py-0.5 text-xs font-semibold text-sage">
                      <CheckCircleIcon className="size-3.5" />
                      {rev.worked ? "Worked as expected" : "Reported issue"}
                    </span>
                    {post && (
                      <Link
                        href={`/p/${post.id}`}
                        className="font-display text-sm font-bold text-ink hover:text-accent"
                      >
                        {post.title}
                      </Link>
                    )}
                  </div>
                  {rev.bug && <p className="text-xs text-muted">&ldquo;{rev.bug}&rdquo;</p>}
                </div>

                {post && (
                  <button
                    type="button"
                    onClick={() => setActiveTryPost(post)}
                    className="rounded-xl border border-border bg-dune px-3.5 py-1.5 text-xs font-semibold text-ink shrink-0 self-start sm:self-center"
                  >
                    Try Demo
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Followers / Following Modal */}
      <dialog
        ref={networkDialogRef}
        aria-labelledby={networkDialogTitleId}
        onClose={() => setNetworkModal(null)}
        onClick={(e) => {
          if (e.target === networkDialogRef.current) setNetworkModal(null);
        }}
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 z-sheet m-0 w-auto sm:w-full sm:max-w-[460px] rounded-2xl border border-border bg-surface text-ink p-5 shadow-2xl"
      >
        {networkModal && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 id={networkDialogTitleId} className="font-display text-base font-bold capitalize">
                {networkModal} ({modalUsers.length})
              </h3>
              <button
                type="button"
                onClick={() => setNetworkModal(null)}
                aria-label="Close list"
                className="rounded-lg p-1.5 text-muted hover:bg-dune hover:text-ink"
              >
                <CloseIcon className="size-5" />
              </button>
            </div>

            <div className="max-h-[340px] overflow-y-auto space-y-2.5 pr-1">
              {modalUsers.map((u) => {
                const isFollowed = followedMap[u.id] ?? networkModal === "following";
                return (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-dune/40 p-2.5"
                  >
                    <Link
                      href={`/u/${u.handle}`}
                      onClick={() => setNetworkModal(null)}
                      className="flex items-center gap-2.5 min-w-0 group"
                    >
                      <img
                        src={u.avatarUrl}
                        alt={u.displayName}
                        className="size-9 rounded-full border border-border bg-surface object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-ink group-hover:text-accent truncate">
                          {u.displayName}
                        </p>
                        <p className="text-[11px] text-muted truncate">@{u.handle}</p>
                      </div>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleToggleListFollow(u.id)}
                      className={cn(
                        "rounded-lg px-3 py-1 text-xs font-semibold transition-colors shrink-0",
                        isFollowed
                          ? "border border-border bg-surface text-ink"
                          : "bg-ink text-dune"
                      )}
                    >
                      {isFollowed ? "Following" : "Follow"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </dialog>

      {/* Edit Profile Modal */}
      <dialog
        ref={editDialogRef}
        aria-labelledby={editDialogTitleId}
        onClose={() => setEditingProfile(false)}
        onClick={(e) => {
          if (e.target === editDialogRef.current) setEditingProfile(false);
        }}
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 z-sheet m-0 w-auto sm:w-full sm:max-w-[480px] rounded-2xl border border-border bg-surface text-ink p-6 shadow-2xl"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 id={editDialogTitleId} className="font-display text-base font-bold text-ink">
              Edit Profile
            </h3>
            <button
              type="button"
              onClick={() => setEditingProfile(false)}
              aria-label="Close edit profile modal"
              className="rounded-lg p-1.5 text-muted hover:bg-dune hover:text-ink"
            >
              <CloseIcon className="size-5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="edit-name" className="block text-xs font-bold text-ink">
                Display Name
              </label>
              <input
                id="edit-name"
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-ink"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="edit-bio" className="block text-xs font-bold text-ink">
                Bio
              </label>
              <textarea
                id="edit-bio"
                rows={3}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-ink"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="edit-github" className="block text-xs font-bold text-ink">
                GitHub URL
              </label>
              <input
                id="edit-github"
                type="url"
                value={editGithub}
                onChange={(e) => setEditGithub(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-sm text-ink"
              />
            </div>

            <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={editCofounder}
                onChange={(e) => setEditCofounder(e.target.checked)}
                className="size-4 accent-accent rounded"
              />
              <span className="text-xs font-semibold text-ink">
                Show &ldquo;Open to Collaborate&rdquo; badge on my profile
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setEditingProfile(false)}
              className="rounded-xl border border-border bg-dune px-4 py-2 text-xs font-semibold text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-dune"
            >
              Save Changes
            </button>
          </div>
        </form>
      </dialog>

      <TrySheet post={activeTryPost} onClose={() => setActiveTryPost(null)} />
      <ShareSheet post={activeSharePost} onClose={() => setActiveSharePost(null)} />
    </div>
  );
}
