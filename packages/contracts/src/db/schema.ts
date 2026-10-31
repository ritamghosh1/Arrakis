import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { BadgeId, FormFieldSchema, ScoreBreakdown } from "../types.js";

/**
 * Custom pgvector column type for Drizzle ORM
 */
export const vector16 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(16)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .filter(Boolean)
      .map(Number);
  },
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url").notNull(),
  role: text("role").notNull().default("builder"),
  bio: text("bio").notNull().default(""),
  githubUrl: text("github_url"),
  followersCount: integer("followers_count").notNull().default(0),
  followingCount: integer("following_count").notNull().default(0),
  scoutXp: integer("scout_xp").notNull().default(0),
  builderScore: doublePrecision("builder_score").notNull().default(0),
  verifiedUtility: boolean("verified_utility").notNull().default(false),
  cofounderOpen: boolean("cofounder_open").notNull().default(false),
  badges: jsonb("badges").$type<BadgeId[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable(
  "posts",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    problemStatement: text("problem_statement").notNull(),
    category: text("category").notNull(),
    videoUrl: text("video_url").notNull(),
    thumbUrl: text("thumb_url").notNull(),
    durationSec: integer("duration_sec").notNull().default(60),
    demoMode: text("demo_mode").notNull(),
    demoTarget: text("demo_target").notNull(),
    formSchema: jsonb("form_schema").$type<FormFieldSchema[] | null>(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    indexingStatus: text("indexing_status").notNull().default("ready"),
    viewsCount: integer("views_count").notNull().default(0),
    triesCount: integer("tries_count").notNull().default(0),
    upvotesCount: integer("upvotes_count").notNull().default(0),
    trialUpvotesCount: integer("trial_upvotes_count").notNull().default(0),
    commentsCount: integer("comments_count").notNull().default(0),
    uptimePct: doublePrecision("uptime_pct").notNull().default(99.0),
    p50LatencyMs: integer("p50_latency_ms").notNull().default(180),
    p95LatencyMs: integer("p95_latency_ms").notNull().default(420),
    crashRate: doublePrecision("crash_rate").notNull().default(0.01),
    postScore: doublePrecision("post_score").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    authorIdx: index("idx_posts_author").on(table.authorId),
    scoreIdx: index("idx_posts_score").on(table.postScore),
  })
);

export const postEmbeddings = pgTable("post_embeddings", {
  postId: text("post_id")
    .primaryKey()
    .references(() => posts.id, { onDelete: "cascade" }),
  embedding: vector16("embedding").notNull(),
  model: text("model").notNull().default("seed-16d"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasteVectors = pgTable("taste_vectors", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  vector: vector16("vector").notNull(),
  categoryAffinities: jsonb("category_affinities").$type<Record<string, number>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: text("followee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.followerId, table.followeeId] }),
    followerIdx: index("idx_follows_follower").on(table.followerId),
    followeeIdx: index("idx_follows_followee").on(table.followeeId),
  })
);

export const events = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id").references(() => posts.id, { onDelete: "cascade" }),
    targetUserId: text("target_user_id").references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    value: doublePrecision("value").default(1.0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userTsIdx: index("idx_events_user_ts").on(table.userId, table.createdAt),
    postTsIdx: index("idx_events_post_ts").on(table.postId, table.createdAt),
  })
);

export const trialRuns = pgTable(
  "trial_runs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    status: text("status").notNull(),
    latencyMs: integer("latency_ms").notNull().default(0),
    httpStatus: integer("http_status"),
    exitCode: integer("exit_code"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => ({
    userPostIdx: index("idx_trial_runs_user_post").on(table.userId, table.postId),
  })
);

export const reviews = pgTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => trialRuns.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    worked: boolean("worked").notNull(),
    wouldUse: boolean("would_use").notNull(),
    bugNote: text("bug_note"),
    xpAwarded: integer("xp_awarded").notNull().default(25),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    postIdx: index("idx_reviews_post").on(table.postId),
  })
);

export const leaderboardSnapshots = pgTable(
  "leaderboard_snapshots",
  {
    boardType: text("board_type").notNull(),
    period: text("period").notNull(),
    entityId: text("entity_id").notNull(),
    rank: integer("rank").notNull(),
    prevRank: integer("prev_rank").notNull(),
    score: doublePrecision("score").notNull(),
    breakdown: jsonb("breakdown").$type<ScoreBreakdown>().notNull(),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.boardType, table.period, table.entityId] }),
  })
);
