import {
  SEED_FOLLOWS,
  SEED_POSTS,
  SEED_POST_VECTORS,
  SEED_USERS,
  SEED_USER_VECTORS,
  ScalableImpressionTracker,
  classifyTelemetryRunTier,
  computeContentHash,
  computeIntentEmbedding,
  computeSimHash64,
  cosineSim,
  deduplicatePosts,
  extractTitleStem,
  getMockGlobalFeed,
  getMockHomeFeed,
  getMockLeaderboard,
  getMockProfile,
  getQuickFeedbackTagDelta,
  hammingDistance64,
  updateEmaVector,
  type DemoMode,
  type FeedItem,
  type FeedResponse,
  type LeaderboardPeriod,
  type LeaderboardResponse,
  type LeaderboardType,
  type Post,
  type ProfileResponse,
  type Review,
  type RunTier,
  type TelemetryPayload,
  type UploadPostInput,
  type User,
  type Hackathon,
} from "@arrakis/contracts";
import {
  USE_DB,
  dbFollowingFeed,
  dbGetFollowersIds,
  dbGetFollowingIds,
  dbGetHackathons,
  dbGetHackathonBySlug,
  dbCreateHackathon,
  dbGetHackathonProjects,
  dbGetPostsByAuthor,
  dbGetRecentUserPublishedPosts,
  dbInsertPost,
  dbLeaderboard,
  dbGetUserVector,
  dbPersonalizedFeed,
  dbPostById,
  dbRecordTelemetry,
  dbSearchGlobalFeed,
  dbToggleFollow,
} from "./db";
import { getYouTubeThumbnailUrl } from "./utils";

/**
 * Runtime store overlaying deterministic seed data so newly uploaded posts,
 * 3-tap micro-reviews, outer-shell sandbox telemetry, and follow toggles persist across requests.
 */
const runtimePosts: Post[] = [];
const runtimeReviews: Review[] = [];
const runtimeFollowDelta = new Map<string, boolean>(); // key: `${followerId}->${followeeId}`
const runtimeXpBonus = new Map<string, number>();
const runtimeUserVectors = new Map<string, number[]>();
const runtimeUserImpressions = new Map<string, Set<string>>();
export const impressionTracker = new ScalableImpressionTracker(5000);

const MOCK = process.env.MOCK !== "0";
const RECOMMENDER_URL = process.env.NEXT_PUBLIC_RECOMMENDER_URL ?? "http://localhost:4001";
const SCORING_URL = process.env.NEXT_PUBLIC_SCORING_URL ?? "http://localhost:4003";

export { CATEGORIES } from "./categories";

export function getAllPosts(): Post[] {
  return deduplicatePosts([...runtimePosts, ...SEED_POSTS]);
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

export async function toggleFollow(
  followerId: string,
  followeeId: string,
  following: boolean,
): Promise<{ ok: boolean; followerId: string; followeeId: string; following: boolean }> {
  if (followerId === followeeId) {
    return { ok: false, followerId, followeeId, following: false };
  }
  recordFollowState(followerId, followeeId, following);
  if (USE_DB) {
    try {
      await dbToggleFollow(followerId, followeeId, following);
    } catch {
      // Fallback to in-memory delta if Postgres is unreachable
    }
  }
  return { ok: true, followerId, followeeId, following };
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
    thumbUrl:
      input.thumbUrl?.trim() ||
      getYouTubeThumbnailUrl(input.videoUrl) ||
      `https://picsum.photos/seed/${encodeURIComponent(id)}/720/1280`,
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
    projectType: input.demo.mode === "web" ? "BROWSER" : "CONTAINER",
    impressions: 14,
    videoCompletions: 10,
    sandboxBounces: 1,
    sandboxSingleRuns: 3,
    sandboxMultiRuns: 2,
    desktopHandoffs: 1,
    proxySuccessRate: 0.997,
    weightedUpvotes: 13,
    weightedUsabilityTags: 6.0,
    sharesCount: 2,
    popularityScore: 28.0,
    usabilityScore: 1.54,
    dailyLeaderboardScore: 0.89,
    hackathonId: input.hackathonId,
    hackathonName: input.hackathonName,
    createdAt: new Date().toISOString(),
  };
  const newHash = computeContentHash(post);
  const newSim = computeSimHash64(post);
  const newStem = extractTitleStem(post.title);
  const existingIdx = runtimePosts.findIndex(
    (p) =>
      computeContentHash(p) === newHash ||
      (newStem.length >= 4 && extractTitleStem(p.title) === newStem && p.authorId === post.authorId) ||
      (p.authorId === post.authorId && hammingDistance64(computeSimHash64(p), newSim) <= 3)
  );
  if (existingIdx >= 0) {
    post.id = runtimePosts[existingIdx]!.id;
    runtimePosts.splice(existingIdx, 1);
  }
  SEED_POST_VECTORS[post.id] = computeIntentEmbedding({
    title: post.title,
    problemStatement: post.problemStatement,
    category: post.category,
    tags: post.tags,
  });
  runtimePosts.unshift(post);
  return post;
}

export function deleteRuntimePost(id: string): boolean {
  const idx = runtimePosts.findIndex((p) => p.id === id);
  if (idx !== -1) {
    runtimePosts.splice(idx, 1);
    delete SEED_POST_VECTORS[id];
    return true;
  }
  return false;
}

export function getUserIntentVector(userId: string): number[] | null {
  return runtimeUserVectors.get(userId) ?? SEED_USER_VECTORS[userId] ?? null;
}

export function recordSandboxTelemetry(payload: TelemetryPayload): {
  run_tier: RunTier;
  tag_delta: number;
  updated_post?: Post;
  updated_user_vector?: number[] | null;
} {
  const runTier = classifyTelemetryRunTier(payload);
  const tagDelta = getQuickFeedbackTagDelta(payload.quick_feedback_tag);
  const userRep = 1.0;
  const healthVal = payload.health_ok ? 1.0 : 0.0;
  const priorC = 50.0;
  const globalMeanM = 1.2;

  const post = getPostById(payload.project_id);
  if (post) {
    const nextImpressions = (post.impressions ?? post.stats.views) + 1;
    const nextBounces = (post.sandboxBounces ?? 0) + (runTier === "BOUNCE" ? 1 : 0);
    const nextSingle = (post.sandboxSingleRuns ?? 0) + (runTier === "SINGLE" ? 1 : 0);
    const nextMulti = (post.sandboxMultiRuns ?? 0) + (runTier === "MULTI" ? 1 : 0);
    const nextTags = (post.weightedUsabilityTags ?? 0) + tagDelta * userRep;
    const prevProxyRate = post.proxySuccessRate ?? post.health.uptimePct / 100;
    const nextProxyRate = Number((0.9 * prevProxyRate + 0.1 * healthVal).toFixed(4));

    const weightedUpvotes =
      post.weightedUpvotes ?? post.stats.trialUpvotes * 3 + (post.stats.upvotes - post.stats.trialUpvotes);
    const videoCompletions = post.videoCompletions ?? Math.floor(post.stats.views * 0.65);
    const commentsCount = post.stats.comments;
    const sharesCount = post.sharesCount ?? 2;
    const desktopHandoffs = post.desktopHandoffs ?? 1;

    const popularityScore = Number(
      (
        weightedUpvotes +
        0.5 * videoCompletions +
        2.0 * commentsCount +
        3.0 * sharesCount
      ).toFixed(2)
    );

    const rawConversion = Math.max(
      0.0,
      -1.0 * nextBounces +
        3.0 * nextSingle +
        7.0 * nextMulti +
        10.0 * desktopHandoffs +
        nextTags +
        priorC * globalMeanM
    );
    const usabilityScore = Number(
      (nextProxyRate * (rawConversion / (nextImpressions + priorC))).toFixed(2)
    );

    const ageHours = Math.max(
      0,
      (Date.now() - new Date(post.createdAt).getTime()) / 3_600_000
    );
    const dailyLeaderboardScore = Number(
      (
        (0.4 * Math.log(Math.max(popularityScore, 1.0)) + 0.6 * usabilityScore) /
        Math.pow(ageHours + 2.0, 1.5)
      ).toFixed(4)
    );

    post.impressions = nextImpressions;
    post.stats.views = nextImpressions;
    if (runTier === "SINGLE" || runTier === "MULTI") {
      post.stats.tries += 1;
    }
    if (payload.quick_feedback_tag === "WORKS_GREAT") {
      post.stats.upvotes += 1;
      post.stats.trialUpvotes += 1;
    }
    post.sandboxBounces = nextBounces;
    post.sandboxSingleRuns = nextSingle;
    post.sandboxMultiRuns = nextMulti;
    post.weightedUsabilityTags = nextTags;
    post.proxySuccessRate = nextProxyRate;
    post.health.uptimePct = Number((nextProxyRate * 100).toFixed(1));
    post.popularityScore = popularityScore;
    post.usabilityScore = usabilityScore;
    post.dailyLeaderboardScore = dailyLeaderboardScore;
    post.postScore = Number((post.postScore + (runTier === "MULTI" ? 3.2 : runTier === "SINGLE" ? 1.8 : 0)).toFixed(2));
  }

  // Record user impression
  let seen = runtimeUserImpressions.get(payload.user_id);
  if (!seen) {
    seen = new Set<string>();
    runtimeUserImpressions.set(payload.user_id, seen);
  }
  seen.add(payload.project_id);

  // Update User Intent Vector via EMA if SINGLE or MULTI and not BUGGY
  let updatedVec = getUserIntentVector(payload.user_id);
  if (
    (runTier === "SINGLE" || runTier === "MULTI") &&
    payload.quick_feedback_tag !== "BUGGY"
  ) {
    const projectVec = SEED_POST_VECTORS[payload.project_id] ?? SEED_POST_VECTORS["post_resume_json"]!;
    updatedVec = updateEmaVector(updatedVec, projectVec, runTier);
    runtimeUserVectors.set(payload.user_id, updatedVec);
    const xpGain = (runTier === "MULTI" ? 50 : 25) + (payload.quick_feedback_tag === "WORKS_GREAT" ? 15 : 0);
    runtimeXpBonus.set(payload.user_id, (runtimeXpBonus.get(payload.user_id) ?? 0) + xpGain);
  }

  return {
    run_tier: runTier,
    tag_delta: tagDelta,
    updated_post: post,
    updated_user_vector: updatedVec,
  };
}

/**
 * Hybrid Personalized Feed Recommender (mirrors Supabase/Postgres get_personalized_feed RPC)
 */
export function getPersonalizedFeedProjects(userId: string, limit = 10): Post[] {
  const userVec = getUserIntentVector(userId);
  const seen = runtimeUserImpressions.get(userId) ?? new Set<string>();
  const all = getAllPosts().filter((p) => (p.proxySuccessRate ?? 1.0) > 0.3);
  const unseen = all.filter((p) => !seen.has(p.id));
  const candidates = unseen.length >= Math.min(limit, 3) ? unseen : all;

  const scored = candidates.map((p) => {
    const postVec = SEED_POST_VECTORS[p.id];
    const intentMatch =
      userVec && postVec ? Math.max(0, Math.min(1, cosineSim(userVec, postVec))) : 0.5;
    const normUsability = Math.min((p.usabilityScore ?? 1.2) / 5.0, 1.0);
    const ageHours = Math.max(0, (Date.now() - new Date(p.createdAt).getTime()) / 3_600_000);
    const timeDecayedPopularity =
      Math.min(Math.log(Math.max(p.popularityScore ?? 1.0, 1.0)) / 10.0, 1.0) /
      Math.pow(ageHours + 2.0, 1.2);
    const coldStartBoost = Math.max(0.0, (100.0 - (p.impressions ?? 100)) / 100.0);

    const hybridScore =
      0.5 * intentMatch +
      0.25 * normUsability +
      0.15 * timeDecayedPopularity +
      0.1 * coldStartBoost;

    return { post: p, hybridScore };
  });

  scored.sort((a, b) => b.hybridScore - a.hybridScore);
  return scored.slice(0, limit).map((s) => s.post);
}

/** Persistence-aware wrappers: Postgres when reachable & seeded, in-memory store otherwise. */
export async function recordTelemetry(payload: TelemetryPayload) {
  if (USE_DB) {
    try {
      const r = await dbRecordTelemetry(payload);
      if (r.post) {
        return { run_tier: r.run_tier, tag_delta: r.tag_delta, updated_post: r.post };
      }
    } catch {
      // Fallback to in-memory store when local Postgres container is not running
    }
  }
  return recordSandboxTelemetry(payload);
}

export async function rankedFeedProjects(userId: string, limit = 10): Promise<Post[]> {
  if (USE_DB) {
    try {
      const rows = await dbPersonalizedFeed(userId, limit);
      if (rows.length > 0) return rows;
    } catch {
      // Fallback to in-memory store
    }
  }
  return getPersonalizedFeedProjects(userId, limit);
}

export async function intentVectorFor(userId: string): Promise<number[] | null> {
  if (USE_DB) {
    try {
      const vec = await dbGetUserVector(userId);
      if (vec) return vec;
    } catch {
      // Fallback to in-memory store
    }
  }
  return getUserIntentVector(userId);
}

export async function getLivePost(id: string): Promise<Post | undefined> {
  if (USE_DB) {
    try {
      const p = await dbPostById(id);
      if (p) return p;
    } catch {
      // Fallback to in-memory store
    }
  }
  return getPostById(id);
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
  if (USE_DB && !cursor) {
    try {
      const dbFollowedIds = await dbGetFollowingIds(userId);
      const followed = new Set(dbFollowedIds);

      if (mode === "following") {
        const posts = await dbFollowingFeed(userId, 10, 0);
        if (posts.length > 0) {
          const items: FeedItem[] = posts.map((post) => ({
            post,
            reason: {
              kind: "followed",
              via: post.author,
              text: `Recommended because you follow @${post.author.handle}`,
            },
            viewerState: {
              upvoted: false,
              tried: false,
              saved: false,
              followingAuthor: true,
            },
          }));
          return { items, nextCursor: null, mode: "following" };
        }
      } else {
        const posts = await dbPersonalizedFeed(userId, 10);
        if (posts.length > 0) {
          const userVec = await dbGetUserVector(userId);
          const seedIdSet = new Set(SEED_POSTS.map((s) => s.id));
          const items: FeedItem[] = posts.map((post, idx) => {
            const sim =
              userVec && SEED_POST_VECTORS[post.id]
                ? cosineSim(userVec, SEED_POST_VECTORS[post.id]!)
                : 0;
            const authorSeed = SEED_USERS.find((u) => u.id === post.authorId);
            const isColdSlot = idx === 2 || idx === 7 || (authorSeed && authorSeed.followersCount === 0);
            const isNewlyPublished = !seedIdSet.has(post.id) && idx !== 2 && idx !== 7;
            const reason: FeedItem["reason"] = isNewlyPublished
              ? {
                  kind: "followed",
                  via: post.author,
                  text: `Just launched by @${post.author.handle} · AI Problem Indexed`,
                }
              : isColdSlot
                ? {
                    kind: "coldstart",
                    text: `Fresh builder · 20% Cold-Start Spotlight (@${post.author.handle})`,
                  }
                : followed.has(post.authorId)
                  ? {
                      kind: "followed",
                      via: post.author,
                      text: `Recommended because you follow @${post.author.handle}`,
                    }
                  : sim >= 0.78
                    ? {
                        kind: "taste",
                        matchedTopic: post.category,
                        similarity: Number(sim.toFixed(2)),
                        text: `Matches tools you tried in ${post.category} (${Math.round(sim * 100)}% match)`,
                      }
                    : {
                        kind: "trending",
                        text: `High Proof-of-Trial velocity (${post.stats.trialUpvotes} verified sandbox tries)`,
                      };
            return {
              post,
              reason,
              viewerState: {
                upvoted: isNewlyPublished,
                tried: false,
                saved: false,
                followingAuthor: followed.has(post.authorId),
              },
            };
          });
          return { items, nextCursor: null, mode: "for_you" };
        }
      }
    } catch {
      // Fallback to in-memory mock feed if Postgres is not running or not yet seeded
    }
  }
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
        items: deduplicatePosts([...prepended, ...base.items]),
      };
    }
    return { ...base, items: deduplicatePosts(base.items) };
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
  if (USE_DB) {
    try {
      const dbResults = await dbSearchGlobalFeed(params);
      if (dbResults.length > 0) {
        const q = params.q?.trim();
        const items: FeedItem[] = dbResults.map(({ post, similarity }) => ({
          post,
          reason: q
            ? {
                kind: "search",
                matchedTopic: q,
                similarity,
                text: `Solves "${q}" · ${Math.round(similarity * 100)}% problem match`,
              }
            : {
                kind: "trending",
                text: `${post.health.uptimePct}% live demo uptime · ${post.stats.tries} instant trials`,
              },
        }));
        return {
          items,
          nextCursor: null,
          mode: "global",
        };
      }
    } catch {
      // Fallback to in-memory search when Postgres is unavailable
    }
  }
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

    let combined = deduplicatePosts([...runtimeMatches, ...base.items]);
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
  if (USE_DB && (type === "trending" || type === "useful" || type === "popular")) {
    try {
      const res = await dbLeaderboard(type, period);
      if (res.rows.length > 0) return res;
    } catch {
      // Fallback to in-memory store
    }
  }
  if (process.env.NEXT_PUBLIC_SCORING_URL) {
    try {
      const qs = new URLSearchParams({ type, period, userId: viewerId });
      const res = await fetch(`${process.env.NEXT_PUBLIC_SCORING_URL}/leaderboard?${qs}`, { cache: "no-store" });
      if (res.ok) return (await res.json()) as LeaderboardResponse;
    } catch {
      // Fallback below
    }
  }
  return getMockLeaderboard(type, period, viewerId, getAllPosts());
}

export async function fetchProfile(handleOrId: string, viewerId = "usr_ritam"): Promise<ProfileResponse> {
  if (process.env.NEXT_PUBLIC_SCORING_URL) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SCORING_URL}/users/${encodeURIComponent(handleOrId)}/profile?viewerId=${encodeURIComponent(viewerId)}`,
        { cache: "no-store" },
      );
      if (res.ok) return (await res.json()) as ProfileResponse;
    } catch {
      // Fallback below
    }
  }
  const base = getMockProfile(handleOrId, viewerId);
  const updatedUser = getUserByHandleOrId(base.user.id) ?? base.user;
  let followerIds = getFollowersForUser(updatedUser.id).map((u) => u.id);
  let followingIds = getFollowingForUser(updatedUser.id).map((u) => u.id);
  let dbAuthorPosts: Post[] = [];
  if (USE_DB) {
    try {
      const [fIds, gIds, authorPosts] = await Promise.all([
        dbGetFollowersIds(updatedUser.id),
        dbGetFollowingIds(updatedUser.id),
        dbGetPostsByAuthor(updatedUser.id),
      ]);
      followerIds = fIds;
      followingIds = gIds;
      dbAuthorPosts = authorPosts;
    } catch {
      // Fallback to in-memory graph
    }
  }
  const userRuntimePosts = runtimePosts.filter((p) => p.authorId === updatedUser.id);
  const userRuntimeReviews = runtimeReviews.filter((r) => r.userId === updatedUser.id);
  return {
    ...base,
    user: {
      ...updatedUser,
      followersCount: followerIds.length || updatedUser.followersCount,
      followingCount: followingIds.length || updatedUser.followingCount,
    },
    isFollowing: followerIds.includes(viewerId),
    projects: deduplicatePosts([...dbAuthorPosts, ...userRuntimePosts, ...base.projects]),
    recentReviews: [...userRuntimeReviews, ...base.recentReviews],
  };
}

/** Posts from builders with zero followers + newly published builds — the "Fresh Builds" rail. */
export function getFreshBuilds(limit = 10): Post[] {
  const cold = new Set(SEED_USERS.filter((u) => u.followersCount === 0).map((u) => u.id));
  const coldPosts = SEED_POSTS.filter((p) => cold.has(p.authorId));
  return deduplicatePosts([...runtimePosts, ...coldPosts]).slice(0, limit);
}

export async function fetchFreshBuilds(limit = 10): Promise<Post[]> {
  if (USE_DB) {
    try {
      const recentDb = await dbGetRecentUserPublishedPosts(5);
      const cold = new Set(SEED_USERS.filter((u) => u.followersCount === 0).map((u) => u.id));
      const coldPosts = SEED_POSTS.filter((p) => cold.has(p.authorId));
      return deduplicatePosts([...recentDb, ...runtimePosts, ...coldPosts]).slice(0, limit);
    } catch {
      // Fallback below
    }
  }
  return getFreshBuilds(limit);
}

const FALLBACK_HACKATHONS: Hackathon[] = [
  {
    id: "hack_arrakis_2026",
    slug: "arrakis-buildathon",
    name: "Arrakis Flagship Buildathon",
    tag: "arrakis-buildathon",
    description:
      "The premier utility-first demo hackathon. Build tools that solve real problems with 1-tap live sandboxes.",
    organizerName: "Arrakis Core Team",
    websiteUrl: "https://arrakis.dev",
    bannerUrl:
      "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80",
    projectCount: 6,
    createdAt: new Date().toISOString(),
  },
  {
    id: "hack_agents_sprint",
    slug: "ai-agents-sprint",
    name: "AI Agents Global Sprint",
    tag: "ai-agents-sprint",
    description:
      "Building autonomous coding assistants, scrapers, and automated browser workflows.",
    organizerName: "DeepMind / Frontier Lab",
    websiteUrl: "https://agents.dev",
    bannerUrl:
      "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80",
    projectCount: 4,
    createdAt: new Date().toISOString(),
  },
  {
    id: "hack_indie_weekend",
    slug: "indie-weekend-2026",
    name: "Indie Hacker 48h Shipathon",
    tag: "indie-weekend",
    description:
      "48-hour challenge to build and launch single-purpose dev utilities and micro-SaaS.",
    organizerName: "Indie Builders Collective",
    websiteUrl: "https://indiehackers.com",
    bannerUrl:
      "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&auto=format&fit=crop&q=80",
    projectCount: 5,
    createdAt: new Date().toISOString(),
  },
];

export async function fetchHackathons(): Promise<Hackathon[]> {
  if (USE_DB) {
    try {
      const dbList = await dbGetHackathons();
      if (dbList.length > 0) return dbList;
    } catch {
      // Fallback
    }
  }
  return FALLBACK_HACKATHONS;
}

export async function fetchHackathonBySlug(slug: string): Promise<Hackathon | null> {
  if (USE_DB) {
    try {
      const h = await dbGetHackathonBySlug(slug);
      if (h) return h;
    } catch {
      // Fallback
    }
  }
  return (
    FALLBACK_HACKATHONS.find(
      (h) => h.slug === slug || h.id === slug || h.tag === slug
    ) ?? null
  );
}

export async function createHackathonSpace(input: {
  name: string;
  slug?: string;
  tag?: string;
  description?: string;
  organizerName?: string;
  websiteUrl?: string;
  bannerUrl?: string;
}): Promise<Hackathon> {
  if (USE_DB) {
    try {
      return await dbCreateHackathon(input);
    } catch {
      // Fallback
    }
  }
  const slug = (
    input.slug ||
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  ).slice(0, 48);
  const created: Hackathon = {
    id: `hack_${Date.now().toString(36)}`,
    slug,
    name: input.name,
    tag: input.tag || `hack-${slug}`,
    description: input.description ?? "",
    organizerName: input.organizerName ?? "Community Organizer",
    websiteUrl: input.websiteUrl,
    bannerUrl: input.bannerUrl,
    projectCount: 0,
    createdAt: new Date().toISOString(),
  };
  FALLBACK_HACKATHONS.unshift(created);
  return created;
}

export async function fetchHackathonProjects(slugOrId: string): Promise<Post[]> {
  if (USE_DB) {
    try {
      const projects = await dbGetHackathonProjects(slugOrId);
      if (projects.length > 0) return projects;
    } catch {
      // Fallback
    }
  }
  return deduplicatePosts(
    [...runtimePosts, ...SEED_POSTS].filter(
      (p) =>
        p.hackathonId === slugOrId ||
        p.tags.some((t) => t.includes(slugOrId) || t.includes("hackathon"))
    )
  );
}
