import pg from "pg";
import {
  SEED_POSTS,
  classifyTelemetryRunTier,
  getQuickFeedbackTagDelta,
  updateEmaVector,
  type LeaderboardPeriod,
  type LeaderboardResponse,
  type LeaderboardRow,
  type LeaderboardType,
  type Post,
  type RunTier,
  type TelemetryPayload,
  type User,
} from "@arrakis/contracts";

/** Postgres-backed persistence (enabled by default unless USE_DB=0). */
export const USE_DB = process.env.USE_DB !== "0";

const globalForPg = globalThis as unknown as { __arrakisPool?: pg.Pool };

export function pool(): pg.Pool {
  if (!globalForPg.__arrakisPool) {
    globalForPg.__arrakisPool = new pg.Pool({
      connectionString:
        process.env.DATABASE_URL ?? "postgresql://arrakis:arrakis_dev@localhost:5432/arrakis",
      max: 5,
      connectionTimeoutMillis: 800,
    });
  }
  return globalForPg.__arrakisPool;
}

const parseVec = (v: string | null | undefined): number[] | null =>
  v ? v.replace(/^\[|\]$/g, "").split(",").filter(Boolean).map(Number) : null;
const toVec = (v: number[]) => `[${v.join(",")}]`;

const POST_SELECT = `
  p.*, u.handle AS a_handle, u.display_name AS a_display_name, u.avatar_url AS a_avatar_url,
  u.verified_utility AS a_verified, p.intent_embedding::text AS intent_text`;

type Row = Record<string, any>;

function rowToPost(r: Row): Post {
  const seed = SEED_POSTS.find((s) => s.id === r.id);
  const uptime = Number(r.uptime_pct);
  return {
    id: r.id,
    authorId: r.author_id,
    author: {
      id: r.author_id,
      handle: r.a_handle,
      displayName: r.a_display_name,
      avatarUrl: r.a_avatar_url,
      verifiedUtility: r.a_verified,
    },
    title: r.title,
    problemStatement: r.problem_statement,
    category: r.category,
    videoUrl: r.video_url,
    thumbUrl: r.thumb_url,
    durationSec: r.duration_sec,
    demo: {
      mode: r.demo_mode,
      target: r.demo_target,
      formSchema: r.form_schema ?? undefined,
      sampleCommand: seed?.demo.sampleCommand,
    },
    tags: r.tags ?? [],
    indexingStatus: r.indexing_status,
    stats: {
      views: r.impressions,
      tries: r.tries_count,
      upvotes: r.upvotes_count,
      trialUpvotes: r.trial_upvotes_count,
      comments: r.comments_count,
    },
    health: {
      uptimePct: Number((Number(r.proxy_success_rate) * 100).toFixed(1)) || uptime,
      p50LatencyMs: r.p50_latency_ms,
      p95LatencyMs: r.p95_latency_ms,
      crashRate: Number(r.crash_rate),
      verifiedUtility: uptime >= 85 && r.tries_count >= 20,
    },
    postScore: Number(r.post_score),
    projectType: r.project_type,
    impressions: r.impressions,
    videoCompletions: r.video_completions,
    sandboxBounces: r.sandbox_bounces,
    sandboxSingleRuns: r.sandbox_single_runs,
    sandboxMultiRuns: r.sandbox_multi_runs,
    desktopHandoffs: r.desktop_handoffs,
    proxySuccessRate: Number(r.proxy_success_rate),
    weightedUpvotes: Number(r.weighted_upvotes),
    weightedUsabilityTags: Number(r.weighted_usability_tags),
    sharesCount: r.shares_count,
    popularityScore: Number(Number(r.popularity_score).toFixed(2)),
    usabilityScore: Number(Number(r.usability_score).toFixed(2)),
    dailyLeaderboardScore: Number(Number(r.daily_leaderboard_score).toFixed(4)),
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function dbGetUserVector(userId: string): Promise<number[] | null> {
  const { rows } = await pool().query(
    "SELECT intent_embedding::text AS v FROM users WHERE id = $1",
    [userId],
  );
  return parseVec(rows[0]?.v);
}

export async function dbPostById(id: string): Promise<Post | null> {
  const { rows } = await pool().query(
    `SELECT ${POST_SELECT} FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = $1`,
    [id],
  );
  return rows[0] ? rowToPost(rows[0]) : null;
}

export async function dbCreatePost(p: Post): Promise<void> {
  const vec = SEED_POSTS[0]
    ? Array.from({ length: 16 }, (_, i) => Number((i === 0 ? 0.85 : 0.12).toFixed(4)))
    : Array(16).fill(0.25);
  await pool().query(
    `INSERT INTO posts (
      id, author_id, title, problem_statement, category, video_url, thumb_url, duration_sec,
      demo_mode, demo_target, target_url, project_type, form_schema, tags, indexing_status,
      embedding, intent_embedding, views_count, tries_count, upvotes_count, trial_upvotes_count,
      comments_count, impressions, video_completions, sandbox_bounces, sandbox_single_runs,
      sandbox_multi_runs, desktop_handoffs, proxy_success_rate, weighted_upvotes,
      weighted_usability_tags, shares_count, popularity_score, usability_score,
      daily_leaderboard_score, uptime_pct, p50_latency_ms, p95_latency_ms, crash_rate,
      post_score, created_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,'ready',
      $15::vector,$15::vector,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39
    ) ON CONFLICT (id) DO NOTHING`,
    [
      p.id,
      p.authorId,
      p.title,
      p.problemStatement,
      p.category,
      p.videoUrl,
      p.thumbUrl,
      p.durationSec,
      p.demo.mode,
      p.demo.target,
      p.demo.target,
      p.projectType ?? (p.demo.mode === "web" ? "BROWSER" : "CONTAINER"),
      JSON.stringify(p.demo.formSchema ?? null),
      JSON.stringify(p.tags),
      toVec(vec),
      p.stats.views,
      p.stats.tries,
      p.stats.upvotes,
      p.stats.trialUpvotes,
      p.stats.comments,
      p.impressions ?? p.stats.views,
      p.videoCompletions ?? 10,
      p.sandboxBounces ?? 1,
      p.sandboxSingleRuns ?? 3,
      p.sandboxMultiRuns ?? 2,
      p.desktopHandoffs ?? 1,
      p.proxySuccessRate ?? 0.997,
      p.weightedUpvotes ?? 13,
      p.weightedUsabilityTags ?? 6.0,
      p.sharesCount ?? 2,
      p.popularityScore ?? 28.0,
      p.usabilityScore ?? 1.54,
      p.dailyLeaderboardScore ?? 0.89,
      p.health.uptimePct,
      p.health.p50LatencyMs,
      p.health.p95LatencyMs,
      p.health.crashRate,
      p.postScore,
      p.createdAt,
    ],
  );
}

/** Ranked feed via get_personalized_feed RPC; tops up with unseen-agnostic ranking when exhausted. */
export async function dbPersonalizedFeed(userId: string, limit = 10): Promise<Post[]> {
  const userVec = await dbGetUserVector(userId);
  const { rows: ranked } = await pool().query(
    "SELECT id FROM get_personalized_feed($1, $2::vector, $3)",
    [userId, userVec ? toVec(userVec) : null, limit],
  );
  const ids: string[] = ranked.map((r) => r.id);

  if (ids.length < limit) {
    const { rows: fill } = await pool().query(
      `SELECT id FROM posts WHERE id <> ALL($1::text[]) AND proxy_success_rate > 0.3
       ORDER BY daily_leaderboard_score DESC LIMIT $2`,
      [ids, limit - ids.length],
    );
    ids.push(...fill.map((r) => r.id));
  }
  if (ids.length === 0) return [];

  const { rows } = await pool().query(
    `SELECT ${POST_SELECT} FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ANY($1::text[])`,
    [ids],
  );
  const byId = new Map(rows.map((r) => [r.id, rowToPost(r)]));
  return ids.map((id) => byId.get(id)!).filter(Boolean);
}

export async function dbRecordTelemetry(payload: TelemetryPayload): Promise<{
  run_tier: RunTier;
  tag_delta: number;
  post: Post | null;
}> {
  const runTier = classifyTelemetryRunTier(payload);
  const tagDelta = getQuickFeedbackTagDelta(payload.quick_feedback_tag);
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    // Apply the upvote weight first so the RPC's popularity recompute includes it.
    if (payload.quick_feedback_tag === "WORKS_GREAT") {
      await client.query(
        "UPDATE posts SET upvotes_count = upvotes_count + 1, trial_upvotes_count = trial_upvotes_count + 1, weighted_upvotes = weighted_upvotes + 3 WHERE id = $1",
        [payload.project_id],
      );
    }
    await client.query("SELECT record_sandbox_telemetry($1,$2,$3,$4,$5)", [
      payload.project_id,
      payload.user_id,
      payload.health_ok,
      runTier,
      tagDelta,
    ]);

    if ((runTier === "SINGLE" || runTier === "MULTI") && payload.quick_feedback_tag !== "BUGGY") {
      const { rows } = await client.query(
        `SELECT p.intent_embedding::text AS pv, u.intent_embedding::text AS uv
         FROM posts p, users u WHERE p.id = $1 AND u.id = $2`,
        [payload.project_id, payload.user_id],
      );
      const pv = parseVec(rows[0]?.pv);
      if (pv) {
        const next = updateEmaVector(parseVec(rows[0]?.uv), pv, runTier);
        const xp = (runTier === "MULTI" ? 50 : 25) + (payload.quick_feedback_tag === "WORKS_GREAT" ? 15 : 0);
        await client.query(
          "UPDATE users SET intent_embedding = $1::vector, scout_xp = scout_xp + $3 WHERE id = $2",
          [toVec(next), payload.user_id, xp],
        );
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return { run_tier: runTier, tag_delta: tagDelta, post: await dbPostById(payload.project_id) };
}

const ORDER: Record<string, string> = {
  trending: "p.daily_leaderboard_score",
  useful: "p.usability_score",
  popular: "p.popularity_score",
};

export async function dbLeaderboard(
  type: Exclude<LeaderboardType, "builders" | "testers">,
  period: LeaderboardPeriod,
): Promise<LeaderboardResponse> {
  const { rows } = await pool().query(
    `SELECT ${POST_SELECT} FROM posts p JOIN users u ON u.id = p.author_id
     ORDER BY ${ORDER[type]} DESC LIMIT 15`,
  );
  const out: LeaderboardRow[] = rows.map((r, idx) => {
    const post = rowToPost(r);
    const passive = post.stats.upvotes - post.stats.trialUpvotes;
    const rank = idx + 1;
    const score =
      type === "useful"
        ? post.usabilityScore ?? 0
        : type === "popular"
          ? Number((post.popularityScore ?? 0).toFixed(1))
          : Number(((post.dailyLeaderboardScore ?? 0) * 100).toFixed(2));
    return {
      rank,
      prevRank: rank,
      delta: 0,
      entityType: "post",
      post,
      score,
      breakdown: {
        weightedVotes: post.stats.trialUpvotes * 3 + passive,
        passiveUpvotes: passive,
        trialUpvotes3x: post.stats.trialUpvotes,
        trialConversionRate: Number((post.stats.tries / Math.max(post.stats.views, 1)).toFixed(2)),
        workedRate: 0.94,
        uptimePct: post.health.uptimePct,
        freshnessDecay: 0.92,
        popularityScore: post.popularityScore,
        usabilityScore: post.usabilityScore,
        dailyLeaderboardScore: post.dailyLeaderboardScore,
        formulaSummary:
          type === "useful"
            ? `S_use=${post.usabilityScore?.toFixed(2)} · ${post.sandboxMultiRuns} multi / ${post.sandboxSingleRuns} single / ${post.sandboxBounces} bounce · ${post.health.uptimePct}% health`
            : type === "popular"
              ? `S_pop=${Math.round(post.popularityScore ?? 0)} · ${post.sharesCount} shares · ${post.stats.comments} comments`
              : `S_pop & S_use time-decayed · live from Postgres`,
      },
    };
  });
  return { type, period, updatedAt: new Date().toISOString(), rows: out };
}

export type { User };
