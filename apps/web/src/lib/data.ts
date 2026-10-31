import {
  SEED_FOLLOWS,
  SEED_POSTS,
  SEED_USERS,
  getMockGlobalFeed,
  getMockHomeFeed,
  getMockLeaderboard,
  getMockProfile,
  type DemoMode,
  type FeedItem,
  type FeedResponse,
  type LeaderboardPeriod,
  type LeaderboardResponse,
  type LeaderboardType,
  type Post,
  type ProfileResponse,
  type Review,
  type UploadPostInput,
  type User,
} from "@arrakis/contracts";

/**
 * Runtime store overlaying deterministic seed data so newly uploaded posts,
 * 3-tap micro-reviews, and follow toggles persist across requests during the demo.
 */
const runtimePosts: Post[] = [];
const runtimeReviews: Review[] = [];
const runtimeFollowDelta = new Map<string, boolean>(); // key: `${followerId}->${followeeId}`
const runtimeXpBonus = new Map<string, number>();

const MOCK = process.env.MOCK !== "0";
const RECOMMENDER_URL = process.env.NEXT_PUBLIC_RECOMMENDER_URL ?? "http://localhost:4001";
const SCORING_URL = process.env.NEXT_PUBLIC_SCORING_URL ?? "http://localhost:4003";

export const CATEGORIES = [
  "Developer Tools",
  "Document & PDF",
  "Data & CSV",
  "Productivity & Automation",
  "Design & Media",
  "Security & Privacy",
] as const;

export function getAllPosts(): Post[] {
  return [...runtimePosts, ...SEED_POSTS];
}

export function getPostById(id: string): Post | undefined {
  return getAllPosts().find((p) => p.id === id);
}

export function getUserByHandleOrId(handleOrId: string): User | undefined {
  const key = handleOrId.toLowerCase();
  const base = SEED_USERS.find((u) => u.id.toLowerCase() === key || u.handle.toLowerCase() === key);
  if (!base) return undefined;
  const bonusXp = runtimeXpBonus.get(base.id) ?? 0;
  return {
    ...base,
    scoutXp: base.scoutXp + bonusXp,
  };
}

export function recordFollowState(followerId: string, followeeId: string, following: boolean) {
  if (followerId === followeeId) return;
  runtimeFollowDelta.set(`${followerId}->${followeeId}`, following);
}

export function getFollowersForUser(userId: string): User[] {
  const followerIds = new Set(
    SEED_FOLLOWS.filter((f) => f.followeeId === userId).map((f) => f.followerId)
  );
  for (const [key, active] of runtimeFollowDelta.entries()) {
    const [fId, targetId] = key.split("->");
    if (targetId === userId && fId) {
      if (active) followerIds.add(fId);
      else followerIds.delete(fId);
    }
  }
  return SEED_USERS.filter((u) => followerIds.has(u.id));
}

export function getFollowingForUser(userId: string): User[] {
  const followingIds = new Set(
    SEED_FOLLOWS.filter((f) => f.followerId === userId).map((f) => f.followeeId)
  );
  for (const [key, active] of runtimeFollowDelta.entries()) {
    const [fId, targetId] = key.split("->");
    if (fId === userId && targetId) {
      if (active) followingIds.add(targetId);
      else followingIds.delete(targetId);
    }
  }
  return SEED_USERS.filter((u) => followingIds.has(u.id));
}

export function createRuntimePost(input: UploadPostInput): Post {
  const author = getUserByHandleOrId(input.authorId) ?? SEED_USERS[0]!;
  const id = `post_${Date.now().toString(36)}`;
  const post: Post = {
    id,
    authorId: author.id,
    author: {
      id: author.id,
      handle: author.handle,
      displayName: author.displayName,
      avatarUrl: author.avatarUrl,
      verifiedUtility: author.verifiedUtility,
    },
    title: input.title.trim(),
    problemStatement: input.problemStatement.trim(),
    category: input.category,
    videoUrl:
      input.videoUrl.trim() ||
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4#t=2",
    thumbUrl: input.thumbUrl?.trim() || `https://picsum.photos/seed/${encodeURIComponent(id)}/720/1280`,
    durationSec: input.durationSec || 60,
    demo: input.demo,
    tags: input.tags.length > 0 ? input.tags : ["utility", "indie"],
    indexingStatus: "ready",
    stats: {
      views: 14,
      tries: 5,
      upvotes: 5,
      trialUpvotes: 4,
      comments: 2,
    },
    health: {
      uptimePct: 99.7,
      p50LatencyMs: 128,
      p95LatencyMs: 260,
      crashRate: 0.003,
      verifiedUtility: true,
    },
    postScore: 48.6,
    createdAt: new Date().toISOString(),
  };
  runtimePosts.unshift(post);
  return post;
}

export function createRuntimeReview(params: {
  runId: string;
  userId: string;
  postId: string;
  worked: boolean;
  wouldUse: boolean;
  bug?: string;
}): Review {
  const post = getPostById(params.postId);
  const isFirst25 = (post?.stats.tries ?? 0) < 250;
  const xpAwarded = (isFirst25 ? 100 : 0) + 25 + (params.bug?.trim() ? 15 : 0);

  const review: Review = {
    id: `rev_${Date.now().toString(36)}`,
    runId: params.runId,
    userId: params.userId,
    postId: params.postId,
    worked: params.worked,
    wouldUse: params.wouldUse,
    bug: params.bug?.trim() || undefined,
    xpAwarded,
    createdAt: new Date().toISOString(),
  };
  runtimeReviews.unshift(review);
  runtimeXpBonus.set(params.userId, (runtimeXpBonus.get(params.userId) ?? 0) + xpAwarded);

  if (post) {
    post.stats.tries += 1;
    if (params.worked) {
      post.stats.upvotes += 1;
      post.stats.trialUpvotes += 1;
      post.postScore = Number((post.postScore + 2.4).toFixed(2));
    }
    if (params.bug?.trim()) {
      post.stats.comments += 1;
    }
  }
  return review;
}

export async function fetchHomeFeed(
  userId: string,
  mode: "for_you" | "following",
  cursor?: string | null,
): Promise<FeedResponse> {
  if (MOCK) {
    const base = getMockHomeFeed(userId, mode, cursor ?? null);
    if (!cursor && runtimePosts.length > 0) {
      const prepended: FeedItem[] = runtimePosts.map((post) => ({
        post,
        reason: {
          kind: "followed",
          via: post.author,
          text: `Just launched by @${post.author.handle} · AI Problem Indexed`,
        },
        viewerState: {
          upvoted: true,
          tried: true,
          saved: false,
          followingAuthor: true,
        },
      }));
      return {
        ...base,
        items: [...prepended, ...base.items],
      };
    }
    return base;
  }
  const qs = new URLSearchParams({ userId, mode });
  if (cursor) qs.set("cursor", cursor);
  const res = await fetch(`${RECOMMENDER_URL}/feed/home?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`recommender ${res.status}`);
  return (await res.json()) as FeedResponse;
}

export async function fetchGlobalFeed(params: {
  q?: string;
  mode?: DemoMode;
  category?: string;
  verifiedOnly?: boolean;
}): Promise<FeedResponse> {
  if (MOCK) {
    const base = getMockGlobalFeed(params.q, params.mode, params.category);
    const runtimeMatches: FeedItem[] = runtimePosts
      .filter((p) => {
        if (params.mode && p.demo.mode !== params.mode) return false;
        if (params.category && p.category.toLowerCase() !== params.category.toLowerCase()) return false;
        if (!params.q) return true;
        const q = params.q.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          p.problemStatement.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .map((post) => ({
        post,
        reason: {
          kind: params.q ? "search" : "trending",
          text: params.q
            ? `Solves "${params.q}" · 98% problem match`
            : `${post.health.uptimePct}% live demo uptime · newly published`,
        },
      }));

    let combined = [...runtimeMatches, ...base.items];
    if (params.verifiedOnly) {
      combined = combined.filter((i) => i.post.health.verifiedUtility);
    }
    return { ...base, items: combined };
  }
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.mode) qs.set("mode", params.mode);
  if (params.category) qs.set("category", params.category);
  const res = await fetch(`${RECOMMENDER_URL}/feed/global?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`recommender ${res.status}`);
  return (await res.json()) as FeedResponse;
}

export async function fetchLeaderboard(
  type: LeaderboardType = "builders",
  period: LeaderboardPeriod = "7d",
  viewerId = "usr_ritam",
): Promise<LeaderboardResponse> {
  if (MOCK) {
    return getMockLeaderboard(type, period, viewerId);
  }
  const qs = new URLSearchParams({ type, period, userId: viewerId });
  const res = await fetch(`${SCORING_URL}/leaderboard?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`scoring ${res.status}`);
  return (await res.json()) as LeaderboardResponse;
}

export async function fetchProfile(handleOrId: string, viewerId = "usr_ritam"): Promise<ProfileResponse> {
  if (MOCK) {
    const base = getMockProfile(handleOrId, viewerId);
    const updatedUser = getUserByHandleOrId(base.user.id) ?? base.user;
    const followers = getFollowersForUser(updatedUser.id);
    const following = getFollowingForUser(updatedUser.id);
    const userRuntimePosts = runtimePosts.filter((p) => p.authorId === updatedUser.id);
    const userRuntimeReviews = runtimeReviews.filter((r) => r.userId === updatedUser.id);
    return {
      ...base,
      user: {
        ...updatedUser,
        followersCount: followers.length || updatedUser.followersCount,
        followingCount: following.length || updatedUser.followingCount,
      },
      isFollowing: followers.some((f) => f.id === viewerId),
      projects: [...userRuntimePosts, ...base.projects],
      recentReviews: [...userRuntimeReviews, ...base.recentReviews],
    };
  }
  const res = await fetch(
    `${SCORING_URL}/users/${encodeURIComponent(handleOrId)}/profile?viewerId=${encodeURIComponent(viewerId)}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`profile ${res.status}`);
  return (await res.json()) as ProfileResponse;
}

/** Posts from builders with zero followers — the "Fresh Builds" rail. */
export function getFreshBuilds(limit = 10): Post[] {
  const cold = new Set(SEED_USERS.filter((u) => u.followersCount === 0).map((u) => u.id));
  const coldPosts = SEED_POSTS.filter((p) => cold.has(p.authorId));
  return [...runtimePosts, ...coldPosts].slice(0, limit);
}
