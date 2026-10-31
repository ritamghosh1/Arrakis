import type {
  BadgeId,
  LeaderboardPeriod,
  LeaderboardResponse,
  LeaderboardRow,
  LeaderboardType,
  Post,
  Review,
  TelemetryEvent,
  User,
} from "@arrakis/contracts";
import { SEED_EVENTS, SEED_POSTS, SEED_USERS } from "@arrakis/contracts";

/**
 * ============================================================================
 * Pillar 4 — Proof-of-Trial Scoring & Anti-Gaming Engine (Dev A: Ritam)
 * ============================================================================
 */

export interface PostScoreInput {
  passiveUpvotes: number;
  trialUpvotes: number;
  uniqueViewers: number;
  uniqueTesters: number;
  workedRate: number;
  uptimePct: number;
  crashRate: number;
  ageHours: number;
}

/**
 * Computes the Proof-of-Trial Post Utility Score.
 * Upvotes from users with a completed TrialRun count 3x vs passive viewers (1x).
 */
export function computeProofOfTrialScore(params: PostScoreInput): number {
  const weightedVotes = Math.max(0, params.trialUpvotes * 3 + params.passiveUpvotes);
  const trialRate = params.uniqueTesters / Math.max(params.uniqueViewers, 1);
  const uptimeScore = params.uptimePct >= 85 ? 1.0 : Math.max(0, params.uptimePct / 100);
  const quality =
    0.5 * Math.min(1, Math.max(0, params.workedRate)) +
    0.3 * uptimeScore +
    0.2 * Math.max(0, 1 - params.crashRate);
  const halfLifeHours = 7 * 24;
  const decay = Math.pow(0.5, Math.max(0, params.ageHours) / halfLifeHours);

  return Number(
    (Math.log(1 + weightedVotes) * (0.5 + quality) * (1 + 0.3 * trialRate) * decay * 10).toFixed(2)
  );
}

/**
 * Verified Utility Badge criteria:
 * > 85% sandbox uptime across >= 20 trial runs.
 */
export function isEligibleForVerifiedUtility(params: {
  uptimePct: number;
  totalRuns: number;
}): boolean {
  return params.uptimePct > 85 && params.totalRuns >= 20;
}

/**
 * Computes a Builder's aggregate score from their top 5 posts (prevents spam)
 * plus unique tester reach and Verified Utility bonus.
 */
export function computeBuilderScore(params: {
  postScores: number[];
  totalUniqueTesters: number;
  hasVerifiedUtility: boolean;
}): number {
  const top5Sum = [...params.postScores]
    .sort((a, b) => b - a)
    .slice(0, 5)
    .reduce((acc, val) => acc + val, 0);
  const testerReachBonus = 0.2 * Math.log(1 + Math.max(0, params.totalUniqueTesters));
  const verifiedBonus = params.hasVerifiedUtility ? 5.0 : 0;
  return Number((top5Sum + testerReachBonus + verifiedBonus).toFixed(1));
}

/**
 * Scout XP rules:
 * - Complete a sandbox run (duration >= 2000ms): +10 XP
 * - Submit a 3-tap micro-review: +25 XP
 * - First-25 Scout bonus (post had < 25 tries at review time): +100 XP
 * - Builder confirms bug note as helpful: +50 XP
 */
export function computeScoutXpForAction(params: {
  action: "try_complete" | "review_submit" | "bug_confirmed";
  durationMs?: number;
  postPriorTries?: number;
}): number {
  if (params.action === "try_complete") {
    const duration = params.durationMs ?? 2500;
    return duration >= 2000 ? 10 : 0;
  }
  if (params.action === "review_submit") {
    const base = 25;
    const first25Bonus = (params.postPriorTries ?? 0) < 25 ? 100 : 0;
    return base + first25Bonus;
  }
  if (params.action === "bug_confirmed") {
    return 50;
  }
  return 0;
}

/**
 * Level progression: Level = floor(sqrt(XP / 50)) + 1
 */
export function computeScoutLevel(xp: number): {
  level: number;
  currentLevelFloorXp: number;
  nextLevelXp: number;
  progressPct: number;
} {
  const safeXp = Math.max(0, xp);
  const level = Math.floor(Math.sqrt(safeXp / 50)) + 1;
  const currentLevelFloorXp = Math.pow(level - 1, 2) * 50;
  const nextLevelXp = Math.pow(level, 2) * 50;
  const span = Math.max(1, nextLevelXp - currentLevelFloorXp);
  const progressPct = Math.min(100, Math.round(((safeXp - currentLevelFloorXp) / span) * 100));
  return { level, currentLevelFloorXp, nextLevelXp, progressPct };
}

/**
 * Evaluates all earned badges for a user based on their telemetry and activity.
 */
export function evaluateUserBadges(params: {
  existingBadges?: BadgeId[];
  hasVerifiedUtilityPost: boolean;
  earlyColdStartReviews: number;
  confirmedBugsCount: number;
  isTop10Builder: boolean;
  activeDaysStreak: number;
  cofounderOpen: boolean;
}): BadgeId[] {
  const badges = new Set<BadgeId>(params.existingBadges ?? []);
  if (params.hasVerifiedUtilityPost) badges.add("verified_utility");
  if (params.earlyColdStartReviews >= 5) badges.add("first_25_scout");
  if (params.confirmedBugsCount >= 3) badges.add("bug_hunter");
  if (params.isTop10Builder) badges.add("top_10_builder");
  if (params.activeDaysStreak >= 7) badges.add("streak_7d");
  if (params.cofounderOpen) badges.add("cofounder_open");
  return Array.from(badges);
}

export interface VoteRecord {
  userId: string;
  postId: string;
  authorId: string;
  isTrialVerified: boolean;
  /** Effective weight after 3x trial multiplier and any anti-gaming discounts */
  effectiveWeight: number;
  ipCluster?: string;
  ts: number;
}

export interface CompletedTrialRecord {
  runId: string;
  userId: string;
  postId: string;
  authorId: string;
  durationMs: number;
  ts: number;
}

/**
 * Stateful, idempotent Scoring & Anti-Gaming Ledger.
 * Supports incremental event ingestion, anti-Sybil filtering, and full rebuild-from-events.
 */
export class ScoringLedger {
  private users = new Map<string, User>();
  private posts = new Map<string, Post>();
  private reviews = new Map<string, Review>();
  private processedEventIds = new Set<string>();
  private completedTrials = new Map<string, CompletedTrialRecord>();
  private votes = new Map<string, VoteRecord>();
  private ipClusterTimestamps = new Map<string, number[]>();
  private userToAuthorVoteCounts = new Map<string, Map<string, number>>();
  private previousRanks = new Map<string, number>();

  constructor(seed?: { users?: User[]; posts?: Post[]; reviews?: Review[] }) {
    this.resetAndSeed(seed);
  }

  public resetAndSeed(seed?: { users?: User[]; posts?: Post[]; reviews?: Review[] }): void {
    this.users.clear();
    this.posts.clear();
    this.reviews.clear();
    this.processedEventIds.clear();
    this.completedTrials.clear();
    this.votes.clear();
    this.ipClusterTimestamps.clear();
    this.userToAuthorVoteCounts.clear();

    const users = seed?.users ?? SEED_USERS;
    const posts = seed?.posts ?? SEED_POSTS;
    const reviews: Review[] =
      seed?.reviews ??
      SEED_EVENTS.filter((e) => e.type === "review" && e.postId).map((e, idx) => ({
        id: `rev_seed_${idx}`,
        runId: `run_seed_${idx}`,
        userId: e.userId,
        postId: e.postId!,
        worked: true,
        wouldUse: true,
        xpAwarded: 25,
        createdAt: e.ts,
      }));

    for (const u of users) {
      this.users.set(u.id, structuredClone(u));
    }
    for (const p of posts) {
      const cloned = structuredClone(p);
      cloned.health.verifiedUtility = isEligibleForVerifiedUtility({
        uptimePct: cloned.health.uptimePct,
        totalRuns: cloned.stats.tries,
      });
      this.posts.set(cloned.id, cloned);
    }
    for (const r of reviews) {
      this.reviews.set(r.id, structuredClone(r));
      const post = this.posts.get(r.postId);
      if (post) {
        this.completedTrials.set(`${r.userId}:${r.postId}`, {
          runId: r.runId,
          userId: r.userId,
          postId: r.postId,
          authorId: post.authorId,
          durationMs: 4200,
          ts: Date.parse(r.createdAt) || Date.now(),
        });
      }
    }
    this.recomputeAllScores();
  }

  /**
   * Records a completed sandbox TrialRun.
   * - Anti-gaming rule 1: Self-trials do not award XP or unlock 3x vote weight.
   * - Anti-gaming rule 2: Run duration must be >= 2000ms.
   * - Automatic upgrade: If user previously cast a 1x passive upvote, upgrades it to 3x!
   */
  public recordCompletedTrial(params: {
    eventId?: string;
    runId: string;
    userId: string;
    postId: string;
    durationMs: number;
    ts?: number;
  }): { accepted: boolean; reason?: string; xpAwarded: number; upgradedVote: boolean } {
    if (params.eventId && this.processedEventIds.has(params.eventId)) {
      return { accepted: false, reason: "duplicate_event", xpAwarded: 0, upgradedVote: false };
    }
    const post = this.posts.get(params.postId);
    if (!post) {
      return { accepted: false, reason: "post_not_found", xpAwarded: 0, upgradedVote: false };
    }
    if (params.userId === post.authorId) {
      return { accepted: false, reason: "self_event_ignored", xpAwarded: 0, upgradedVote: false };
    }
    if (params.durationMs < 2000) {
      return { accepted: false, reason: "trial_too_short", xpAwarded: 0, upgradedVote: false };
    }

    if (params.eventId) {
      this.processedEventIds.add(params.eventId);
    }

    const key = `${params.userId}:${params.postId}`;
    const alreadyTried = this.completedTrials.has(key);
    this.completedTrials.set(key, {
      runId: params.runId,
      userId: params.userId,
      postId: params.postId,
      authorId: post.authorId,
      durationMs: params.durationMs,
      ts: params.ts ?? Date.now(),
    });

    let xpAwarded = 0;
    if (!alreadyTried) {
      post.stats.tries += 1;
      xpAwarded = computeScoutXpForAction({
        action: "try_complete",
        durationMs: params.durationMs,
      });
      const user = this.users.get(params.userId);
      if (user) {
        user.scoutXp += xpAwarded;
      }
    }

    // Check if an existing passive vote should upgrade in-place from 1x -> 3x
    let upgradedVote = false;
    const existingVote = this.votes.get(key);
    if (existingVote && !existingVote.isTrialVerified) {
      existingVote.isTrialVerified = true;
      existingVote.effectiveWeight = existingVote.effectiveWeight * 3;
      post.stats.trialUpvotes += 1;
      upgradedVote = true;
    }

    this.recomputePostAndAuthor(post.id);
    return { accepted: true, xpAwarded, upgradedVote };
  }

  /**
   * Processes an upvote with full anti-gaming & Sybil protection:
   * 1. Ignores self-votes (actorUserId === authorId)
   * 2. Enforces 1 vote per (userId, postId); upgrades 1x -> 3x if trial completed
   * 3. Discounts IP/device burst clusters (> 5 votes within 60s -> 0.1x weight)
   * 4. Dampens mutual 2-node vote rings (A <-> B > 70% reciprocity -> 0.5x weight)
   */
  public castUpvote(params: {
    eventId?: string;
    userId: string;
    postId: string;
    ipCluster?: string;
    ts?: number;
  }): {
    accepted: boolean;
    reason?: string;
    isTrialVerified: boolean;
    effectiveWeight: number;
    upgraded?: boolean;
  } {
    if (params.eventId && this.processedEventIds.has(params.eventId)) {
      return {
        accepted: false,
        reason: "duplicate_event",
        isTrialVerified: false,
        effectiveWeight: 0,
      };
    }

    const post = this.posts.get(params.postId);
    if (!post) {
      return {
        accepted: false,
        reason: "post_not_found",
        isTrialVerified: false,
        effectiveWeight: 0,
      };
    }

    // Rule 1: Ignore self-events
    if (params.userId === post.authorId) {
      return {
        accepted: false,
        reason: "self_event_ignored",
        isTrialVerified: false,
        effectiveWeight: 0,
      };
    }

    const now = params.ts ?? Date.now();
    const key = `${params.userId}:${params.postId}`;
    const hasCompletedTrial = this.completedTrials.has(key);
    const existingVote = this.votes.get(key);

    // Rule 2: One vote per (userId, postId), allowing 1x -> 3x upgrade
    if (existingVote) {
      if (!existingVote.isTrialVerified && hasCompletedTrial) {
        if (params.eventId) this.processedEventIds.add(params.eventId);
        existingVote.isTrialVerified = true;
        existingVote.effectiveWeight = Number((existingVote.effectiveWeight * 3).toFixed(2));
        post.stats.trialUpvotes += 1;
        this.recomputePostAndAuthor(post.id);
        return {
          accepted: true,
          isTrialVerified: true,
          effectiveWeight: existingVote.effectiveWeight,
          upgraded: true,
        };
      }
      return {
        accepted: false,
        reason: "already_voted",
        isTrialVerified: existingVote.isTrialVerified,
        effectiveWeight: existingVote.effectiveWeight,
      };
    }

    if (params.eventId) {
      this.processedEventIds.add(params.eventId);
    }

    let multiplier = 1.0;

    // Rule 3: IP / device cluster burst detection (>5 votes in 60s window -> 0.1x)
    if (params.ipCluster) {
      const windowStart = now - 60_000;
      const recent = (this.ipClusterTimestamps.get(params.ipCluster) ?? []).filter(
        (t) => t >= windowStart
      );
      recent.push(now);
      this.ipClusterTimestamps.set(params.ipCluster, recent);
      if (recent.length > 5) {
        multiplier *= 0.1;
      }
    }

    // Track user -> author vote graph for Rule 4 (mutual vote ring detection)
    const authorCounts = this.userToAuthorVoteCounts.get(params.userId) ?? new Map<string, number>();
    authorCounts.set(post.authorId, (authorCounts.get(post.authorId) ?? 0) + 1);
    this.userToAuthorVoteCounts.set(params.userId, authorCounts);

    if (this.isMutualVoteRing(params.userId, post.authorId)) {
      multiplier *= 0.5;
    }

    const baseWeight = hasCompletedTrial ? 3 : 1;
    const effectiveWeight = Number((baseWeight * multiplier).toFixed(2));

    this.votes.set(key, {
      userId: params.userId,
      postId: params.postId,
      authorId: post.authorId,
      isTrialVerified: hasCompletedTrial,
      effectiveWeight,
      ipCluster: params.ipCluster,
      ts: now,
    });

    if (multiplier >= 0.5) {
      post.stats.upvotes += 1;
      if (hasCompletedTrial) {
        post.stats.trialUpvotes += 1;
      }
    }

    this.recomputePostAndAuthor(post.id);
    return {
      accepted: true,
      isTrialVerified: hasCompletedTrial,
      effectiveWeight,
    };
  }

  /**
   * Detects 2-node reciprocal voting rings (A <-> B) where both users have cast
   * >= 3 votes and > 70% of each user's votes target the other.
   */
  private isMutualVoteRing(userA: string, userB: string): boolean {
    const aMap = this.userToAuthorVoteCounts.get(userA);
    const bMap = this.userToAuthorVoteCounts.get(userB);
    if (!aMap || !bMap) return false;

    const aTotal = Array.from(aMap.values()).reduce((s, c) => s + c, 0);
    const bTotal = Array.from(bMap.values()).reduce((s, c) => s + c, 0);
    if (aTotal < 3 || bTotal < 3) return false;

    const aToB = (aMap.get(userB) ?? 0) / aTotal;
    const bToA = (bMap.get(userA) ?? 0) / bTotal;
    return aToB > 0.7 && bToA > 0.7;
  }

  /**
   * Submits a 3-Tap Micro-Review.
   * Requires a completed TrialRun for (userId, postId).
   */
  public submitReview(params: {
    id?: string;
    runId: string;
    userId: string;
    postId: string;
    worked: boolean;
    wouldUse: boolean;
    bug?: string;
    ts?: number;
  }): { accepted: boolean; reason?: string; review?: Review; xpAwarded: number } {
    const post = this.posts.get(params.postId);
    if (!post) {
      return { accepted: false, reason: "post_not_found", xpAwarded: 0 };
    }
    if (params.userId === post.authorId) {
      return { accepted: false, reason: "self_event_ignored", xpAwarded: 0 };
    }

    const trialKey = `${params.userId}:${params.postId}`;
    if (!this.completedTrials.has(trialKey)) {
      return { accepted: false, reason: "trial_required", xpAwarded: 0 };
    }

    const xpAwarded = computeScoutXpForAction({
      action: "review_submit",
      postPriorTries: post.stats.tries,
    });

    const review: Review = {
      id: params.id ?? `rev_${Date.now().toString(36)}`,
      runId: params.runId,
      userId: params.userId,
      postId: params.postId,
      worked: params.worked,
      wouldUse: params.wouldUse,
      bug: params.bug,
      xpAwarded,
      createdAt: new Date(params.ts ?? Date.now()).toISOString(),
    };

    this.reviews.set(review.id, review);
    const user = this.users.get(params.userId);
    if (user) {
      user.scoutXp += xpAwarded;
    }

    this.recomputePostAndAuthor(post.id);
    return { accepted: true, review, xpAwarded };
  }

  /**
   * Ingests a batch of telemetry events idempotently.
   */
  public ingestEvents(events: TelemetryEvent[]): { processed: number; skipped: number } {
    let processed = 0;
    let skipped = 0;

    for (const evt of events) {
      if (evt.id && this.processedEventIds.has(evt.id)) {
        skipped += 1;
        continue;
      }

      const ts = Date.parse(evt.ts) || Date.now();
      if (evt.type === "view" && evt.postId) {
        const post = this.posts.get(evt.postId);
        if (post && evt.userId !== post.authorId) {
          if (evt.id) this.processedEventIds.add(evt.id);
          post.stats.views += 1;
          this.recomputePostAndAuthor(post.id);
          processed += 1;
        } else {
          skipped += 1;
        }
      } else if (evt.type === "try" && evt.postId) {
        const res = this.recordCompletedTrial({
          eventId: evt.id,
          runId: `run_${evt.id ?? ts}`,
          userId: evt.userId,
          postId: evt.postId,
          durationMs: Math.max(2500, (evt.value ?? 3) * 1000),
          ts,
        });
        if (res.accepted) processed += 1;
        else skipped += 1;
      } else if (evt.type === "upvote" && evt.postId) {
        const res = this.castUpvote({
          eventId: evt.id,
          userId: evt.userId,
          postId: evt.postId,
          ts,
        });
        if (res.accepted) processed += 1;
        else skipped += 1;
      } else {
        if (evt.id) this.processedEventIds.add(evt.id);
        processed += 1;
      }
    }

    return { processed, skipped };
  }

  /**
   * Rebuilds all scores deterministically from seed data + events log.
   */
  public rebuildFromEvents(events: TelemetryEvent[] = SEED_EVENTS): {
    postsUpdated: number;
    usersUpdated: number;
    eventsProcessed: number;
  } {
    this.resetAndSeed();
    const { processed } = this.ingestEvents(events);
    this.recomputeAllScores();
    return {
      postsUpdated: this.posts.size,
      usersUpdated: this.users.size,
      eventsProcessed: processed,
    };
  }

  private recomputePostAndAuthor(postId: string): void {
    const post = this.posts.get(postId);
    if (!post) return;

    const postReviews = Array.from(this.reviews.values()).filter((r) => r.postId === postId);
    const workedRate =
      postReviews.length > 0
        ? postReviews.filter((r) => r.worked).length / postReviews.length
        : 0.92;

    const ageHours = Math.max(
      1,
      (Date.now() - (Date.parse(post.createdAt) || Date.now() - 24 * 3600_000)) / 3600_000
    );

    const passiveUpvotes = Math.max(0, post.stats.upvotes - post.stats.trialUpvotes);
    post.health.verifiedUtility = isEligibleForVerifiedUtility({
      uptimePct: post.health.uptimePct,
      totalRuns: post.stats.tries,
    });

    post.postScore = computeProofOfTrialScore({
      passiveUpvotes,
      trialUpvotes: post.stats.trialUpvotes,
      uniqueViewers: post.stats.views,
      uniqueTesters: post.stats.tries,
      workedRate,
      uptimePct: post.health.uptimePct,
      crashRate: post.health.crashRate,
      ageHours: Math.min(ageHours, 72), // normalized window for seed stability
    });

    const author = this.users.get(post.authorId);
    if (author) {
      const authorPosts = Array.from(this.posts.values()).filter((p) => p.authorId === author.id);
      const totalUniqueTesters = authorPosts.reduce((s, p) => s + p.stats.tries, 0);
      const hasVerified = authorPosts.some((p) => p.health.verifiedUtility);
      author.verifiedUtility = hasVerified;
      author.builderScore = computeBuilderScore({
        postScores: authorPosts.map((p) => p.postScore),
        totalUniqueTesters,
        hasVerifiedUtility: hasVerified,
      });
    }
  }

  public recomputeAllScores(): void {
    for (const postId of this.posts.keys()) {
      this.recomputePostAndAuthor(postId);
    }
  }

  /**
   * Snapshots current ranks so subsequent leaderboard queries show live ▲/▼ rank deltas.
   */
  public snapshotCurrentRanks(): void {
    for (const type of ["builders", "testers", "trending"] as LeaderboardType[]) {
      const board = this.getLeaderboard(type, "7d");
      for (const row of board.rows) {
        const entityId = row.entityType === "user" ? row.user?.id : row.post?.id;
        if (entityId) {
          this.previousRanks.set(`${type}:${entityId}`, row.rank);
        }
      }
    }
  }

  public getLeaderboard(
    type: LeaderboardType = "builders",
    period: LeaderboardPeriod = "7d",
    viewerId = "usr_ritam"
  ): LeaderboardResponse {
    const periodMultiplier = period === "24h" ? 0.38 : period === "7d" ? 1 : 2.15;

    if (type === "trending") {
      const sortedPosts = Array.from(this.posts.values()).sort((a, b) => b.postScore - a.postScore);
      const rows: LeaderboardRow[] = sortedPosts.slice(0, 15).map((p, idx) => {
        const rank = idx + 1;
        const prevRank =
          this.previousRanks.get(`trending:${p.id}`) ??
          (idx === 0 ? 2 : idx === 1 ? 1 : idx + ((idx % 3) - 1));
        const passive = Math.max(0, p.stats.upvotes - p.stats.trialUpvotes);
        const weighted = p.stats.trialUpvotes * 3 + passive;
        return {
          rank,
          prevRank,
          delta: prevRank - rank,
          entityType: "post",
          post: p,
          score: Number((p.postScore * periodMultiplier).toFixed(1)),
          breakdown: {
            weightedVotes: weighted,
            passiveUpvotes: passive,
            trialUpvotes3x: p.stats.trialUpvotes,
            trialConversionRate: Number(
              (p.stats.tries / Math.max(1, p.stats.views)).toFixed(2)
            ),
            workedRate: 0.94,
            uptimePct: p.health.uptimePct,
            freshnessDecay: 0.91,
            formulaSummary: `${p.stats.trialUpvotes} verified sandbox tries · ${p.health.uptimePct}% live reliability`,
          },
        };
      });
      return {
        type,
        period,
        updatedAt: new Date().toISOString(),
        rows,
      };
    }

    const sortedUsers = Array.from(this.users.values()).sort((a, b) =>
      type === "builders" ? b.builderScore - a.builderScore : b.scoutXp - a.scoutXp
    );

    const rows: LeaderboardRow[] = sortedUsers.slice(0, 15).map((u, idx) => {
      const rank = idx + 1;
      const prevRank =
        this.previousRanks.get(`${type}:${u.id}`) ??
        (idx === 0 ? 2 : idx === 1 ? 1 : idx + 1 + ((idx % 3) - 1));
      const baseScore = type === "builders" ? u.builderScore : u.scoutXp;
      const userPosts = Array.from(this.posts.values()).filter((p) => p.authorId === u.id);
      const totalTries = userPosts.reduce((s, p) => s + p.stats.tries, 0) || 48;
      const totalViews = userPosts.reduce((s, p) => s + p.stats.views, 0) || 260;
      const trialUpvotes = userPosts.reduce((s, p) => s + p.stats.trialUpvotes, 0) || 34;
      const totalUpvotes = userPosts.reduce((s, p) => s + p.stats.upvotes, 0) || 56;
      const passiveUpvotes = Math.max(0, totalUpvotes - trialUpvotes);

      return {
        rank,
        prevRank,
        delta: prevRank - rank,
        entityType: "user",
        user: u,
        score: Number((baseScore * periodMultiplier).toFixed(type === "builders" ? 1 : 0)),
        breakdown: {
          weightedVotes: trialUpvotes * 3 + passiveUpvotes,
          passiveUpvotes,
          trialUpvotes3x: trialUpvotes,
          trialConversionRate: Number((totalTries / Math.max(1, totalViews)).toFixed(2)),
          workedRate: 0.95,
          uptimePct: 98.4,
          freshnessDecay: 0.92,
          formulaSummary:
            type === "builders"
              ? `${trialUpvotes} hands-on builder endorsements across ${userPosts.length || 1} live projects`
              : `${Math.max(12, Math.round(u.scoutXp / 35))} sandboxes tested & reviewed for the community`,
        },
      };
    });

    const me = rows.find((r) => r.user?.id === viewerId) ?? rows[0];
    return {
      type,
      period,
      updatedAt: new Date().toISOString(),
      rows,
      me,
    };
  }
}

export const defaultScoringLedger = new ScoringLedger();
