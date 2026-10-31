/**
 * ============================================================================
 * @arrakis/contracts — Frozen v0 Shared API & Domain Contracts
 * ============================================================================
 * Single source of truth for:
 *   - Dev A (Ritam):   apps/web (Next.js PWA) + services/scoring (Leaderboard)
 *   - Dev B (Srinjoy): services/recommender (FastAPI) + services/sandbox (Docker)
 *
 * Mirrors: services/recommender/app/contracts.py & packages/contracts/openapi.yaml
 */

export type UserRole = "builder" | "tester" | "both";

export type BadgeId =
  | "verified_utility"
  | "first_25_scout"
  | "bug_hunter"
  | "cofounder_open"
  | "top_10_builder"
  | "streak_7d";

export interface UserRef {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  verifiedUtility?: boolean;
}

export interface User extends UserRef {
  role: UserRole;
  bio: string;
  githubUrl?: string;
  followersCount: number;
  followingCount: number;
  scoutXp: number;
  builderScore: number;
  verifiedUtility: boolean;
  cofounderOpen: boolean;
  badges: BadgeId[];
  createdAt: string;
}

export type DemoMode = "api" | "web" | "container" | "handoff";
export type SandboxProjectType = "BROWSER" | "CONTAINER";
export type RunTier = "BOUNCE" | "SINGLE" | "MULTI";
export type QuickFeedbackTag = "WORKS_GREAT" | "BUGGY" | null;

export interface TelemetryPayload {
  project_id: string;
  user_id: string;
  project_type: SandboxProjectType;
  health_ok: boolean;
  boot_time_ms: number;
  switched_to_landscape: boolean;
  active_dwell_seconds: number;
  interaction_bursts: number;
  quick_feedback_tag: QuickFeedbackTag;
}

export interface PreflightResponse {
  health_ok: boolean;
  can_iframe: boolean;
  latency_ms: number;
}

export interface FormFieldSchema {
  name: string;
  label: string;
  type: "text" | "number" | "url" | "json" | "select" | "boolean";
  required: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  options?: string[];
}

export interface DemoConfig {
  mode: DemoMode;
  /** URL for api/web/handoff, or Docker image/repo reference for container mode */
  target: string;
  /** Optional Dockerfile repo URL if building from source */
  repoUrl?: string;
  /** Calculated git commit SHA */
  repoSha?: string;
  /** Flagged duplicate / plagiarism status */
  isDuplicateFlagged?: boolean;
  duplicateOf?: string;
  /** Auto-generated form fields for API/CLI/Container modes */
  formSchema?: FormFieldSchema[];
  /** Default CLI args or sample payload */
  sampleCommand?: string;
}

export interface PostHealthTelemetry {
  uptimePct: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  crashRate: number;
  verifiedUtility: boolean;
}

export interface PostStats {
  views: number;
  tries: number;
  upvotes: number;
  /** Upvotes from users with a completed TrialRun (count 3x in Proof-of-Trial) */
  trialUpvotes: number;
  comments: number;
}

export interface Post {
  id: string;
  authorId: string;
  author: UserRef;
  title: string;
  /** AI-extracted or builder-confirmed problem statement (indexed in pgvector) */
  problemStatement: string;
  category: string;
  videoUrl: string;
  thumbUrl: string;
  durationSec: number;
  demo: DemoConfig;
  tags: string[];
  indexingStatus: "pending" | "ready" | "failed";
  stats: PostStats;
  health: PostHealthTelemetry;
  postScore: number;
  /** Dual-Scoring & Outer-Shell Telemetry fields */
  projectType?: SandboxProjectType;
  impressions?: number;
  videoCompletions?: number;
  sandboxBounces?: number;
  sandboxSingleRuns?: number;
  sandboxMultiRuns?: number;
  desktopHandoffs?: number;
  proxySuccessRate?: number;
  weightedUpvotes?: number;
  weightedUsabilityTags?: number;
  sharesCount?: number;
  popularityScore?: number;
  usabilityScore?: number;
  dailyLeaderboardScore?: number;
  hackathonId?: string;
  hackathonName?: string;
  isDuplicateFlagged?: boolean;
  gitCommitSha?: string;
  createdAt: string;
}

export interface Hackathon {
  id: string;
  slug: string;
  name: string;
  tag: string;
  description: string;
  organizerName: string;
  websiteUrl?: string;
  bannerUrl?: string;
  projectCount?: number;
  createdAt: string;
}

export type ReasonKind = "followed" | "taste" | "coldstart" | "trending" | "search";

export interface Reason {
  kind: ReasonKind;
  /** Populated when kind === 'followed' (1st-degree author or 2nd-degree tester you follow) */
  via?: UserRef;
  /** Matched phrase or similarity score when kind === 'search' or 'taste' */
  matchedTopic?: string;
  similarity?: number;
  /** Human-readable chip copy, e.g. "Recommended because you follow @aanya" */
  text: string;
}

export interface FeedItem {
  post: Post;
  reason: Reason;
  viewerState?: {
    upvoted: boolean;
    tried: boolean;
    saved: boolean;
    followingAuthor: boolean;
  };
}

export interface FeedResponse {
  items: FeedItem[];
  nextCursor: string | null;
  mode: "for_you" | "following" | "global";
}

export type EventType = "view" | "try" | "review" | "upvote" | "share" | "follow";

export interface TelemetryEvent {
  id?: string;
  userId: string;
  postId?: string;
  targetUserId?: string;
  type: EventType;
  /** Weight modifier or dwell seconds */
  value?: number;
  ts: string;
}

export type TrialRunStatus =
  | "queued"
  | "starting"
  | "running"
  | "succeeded"
  | "timed_out"
  | "rate_limited"
  | "failed";

export interface TrialRun {
  id: string;
  userId: string;
  postId: string;
  mode: DemoMode;
  status: TrialRunStatus;
  queuePosition?: number;
  streamUrl: string;
  sandboxUrl?: string;
  latencyMs: number;
  httpStatus?: number;
  exitCode?: number;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface SseStreamEvent {
  type: "status" | "log" | "result" | "health" | "error";
  runId: string;
  timestamp: string;
  status?: TrialRunStatus;
  line?: string;
  stream?: "stdout" | "stderr" | "system";
  output?: unknown;
  health?: PostHealthTelemetry;
}

export interface Review {
  id: string;
  runId: string;
  userId: string;
  postId: string;
  worked: boolean;
  wouldUse: boolean;
  bug?: string;
  xpAwarded: number;
  createdAt: string;
}

export type LeaderboardType = "builders" | "testers" | "trending" | "useful" | "popular";
export type LeaderboardPeriod = "24h" | "7d" | "all";

export interface ScoreBreakdown {
  weightedVotes: number;
  passiveUpvotes: number;
  trialUpvotes3x: number;
  trialConversionRate: number;
  workedRate: number;
  uptimePct: number;
  freshnessDecay: number;
  formulaSummary: string;
  popularityScore?: number;
  usabilityScore?: number;
  dailyLeaderboardScore?: number;
}

export interface LeaderboardRow {
  rank: number;
  prevRank: number;
  /** Positive = moved up (e.g. +2 means #5 -> #3) */
  delta: number;
  entityType: "user" | "post";
  user?: User;
  post?: Post;
  score: number;
  breakdown: ScoreBreakdown;
}

export interface LeaderboardResponse {
  type: LeaderboardType;
  period: LeaderboardPeriod;
  updatedAt: string;
  rows: LeaderboardRow[];
  me?: LeaderboardRow;
}

export interface ProfileResponse {
  user: User;
  isFollowing: boolean;
  rank: {
    builderRank?: number;
    testerRank?: number;
    percentile: number;
  };
  projects: Post[];
  triedPosts: Post[];
  recentReviews: Review[];
}

export interface UploadPostInput {
  authorId: string;
  title: string;
  problemStatement: string;
  category: string;
  videoUrl: string;
  thumbUrl?: string;
  durationSec: number;
  demo: DemoConfig;
  tags: string[];
  hackathonId?: string;
  hackathonName?: string;
  isDuplicateFlagged?: boolean;
  gitCommitSha?: string;
}

export interface GitFileHash {
  path: string;
  blobSha: string;
  sizeBytes: number;
  commitMessage: string;
}

export interface GitInspectionResult {
  repoUrl: string;
  normalizedUrl: string;
  branch: string;
  commitSha: string;
  treeSha: string;
  parentSha?: string;
  files: GitFileHash[];
  isDuplicate: boolean;
  isFlagged: boolean;
  flagReason?: string;
  matchedProject?: {
    id: string;
    title: string;
    authorHandle: string;
    registeredAt?: string;
    repoUrl: string;
  };
}

export interface StoredGitHashRecord {
  urlHash: string;
  commitSha: string;
  treeSha: string;
  repoUrl: string;
  normalizedUrl: string;
  projectId: string;
  projectTitle: string;
  authorHandle: string;
  registeredAt: string;
}

