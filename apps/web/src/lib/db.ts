import pg from "pg";
import {
  SEED_POSTS,
  SEED_POST_VECTORS,
  classifyTelemetryRunTier,
  computeContentHash,
  computeIntentEmbedding,
  deduplicatePosts,
  getQuickFeedbackTagDelta,
  updateEmaVector,
  type DemoMode,
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
  if (r.intent_text && !SEED_POST_VECTORS[r.id]) {
    const parsed = parseVec(r.intent_text);
    if (parsed) SEED_POST_VECTORS[r.id] = parsed;
  }
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

export async function dbInsertPost(post: Post): Promise<void> {
  const embedding = computeIntentEmbedding({
    title: post.title,
    problemStatement: post.problemStatement,
    category: post.category,
    tags: post.tags,
  });
  SEED_POST_VECTORS[post.id] = embedding;
  const vecStr = toVec(embedding);

  await pool().query(
    `INSERT INTO posts (
      id, author_id, title, problem_statement, category, video_url, thumb_url,
      duration_sec, demo_mode, demo_target, form_schema, tags, indexing_status,
      impressions, tries_count, upvotes_count, trial_upvotes_count, comments_count,
      uptime_pct, p50_latency_ms, p95_latency_ms, crash_rate, post_score,
      project_type, proxy_success_rate, popularity_score, usability_score, daily_leaderboard_score,
      intent_embedding
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11::jsonb, $12::jsonb, $13,
      $14, $15, $16, $17, $18,
      $19, $20, $21, $22, $23,
      $24, $25, $26, $27, $28,
      $29::vector
    ) ON CONFLICT (id) DO UPDATE SET
      intent_embedding = EXCLUDED.intent_embedding`,
    [
      post.id,
      post.authorId,
      post.title,
      post.problemStatement,
      post.category,
      post.videoUrl,
      post.thumbUrl,
      post.durationSec,
      post.demo.mode,
      post.demo.target,
      JSON.stringify(post.demo.formSchema ?? []),
      JSON.stringify(post.tags ?? []),
      post.indexingStatus,
      post.stats.views,
      post.stats.tries,
      post.stats.upvotes,
      post.stats.trialUpvotes,
      post.stats.comments,
      post.health.uptimePct,
      post.health.p50LatencyMs,
      post.health.p95LatencyMs,
      post.health.crashRate,
      post.postScore,
      post.demo.mode === "web" ? "BROWSER" : "CONTAINER",
      0.99,
      post.postScore,
      2.15,
      0.065,
      vecStr,
    ]
  );

  await pool().query(
    `INSERT INTO post_embeddings (post_id, embedding) VALUES ($1, $2::vector)
     ON CONFLICT (post_id) DO UPDATE SET embedding = EXCLUDED.embedding, updated_at = NOW()`,
    [post.id, vecStr]
  );
}

export const dbCreatePost = dbInsertPost;
export async function dbPersonalizedFeed(userId: string, limit = 10): Promise<Post[]> {
  const userVec = await dbGetUserVector(userId);
  const fetchCount = Math.max(limit * 6, 60);
  const { rows: ranked } = await pool().query(
    "SELECT id FROM get_personalized_feed($1, $2::vector, $3)",
    [userId, userVec ? toVec(userVec) : null, fetchCount],
  );
  const ids: string[] = ranked.map((r) => r.id);

  if (ids.length < fetchCount) {
    const { rows: fill } = await pool().query(
      `SELECT id FROM posts WHERE id <> ALL($1::text[]) AND proxy_success_rate > 0.3
       ORDER BY daily_leaderboard_score DESC LIMIT $2`,
      [ids, fetchCount - ids.length],
    );
    ids.push(...fill.map((r) => r.id));
  }
  if (ids.length === 0) return [];

  const { rows } = await pool().query(
    `SELECT ${POST_SELECT} FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ANY($1::text[])`,
    [ids],
  );
  const byId = new Map(rows.map((r) => [r.id, rowToPost(r)]));
  const orderedCandidates = ids.map((id) => byId.get(id)!).filter(Boolean);

  // Deduplicate by exact ID, canonical title stem, 64-bit contentHash, and 64-bit LSH SimHash
  let deduped = deduplicatePosts(orderedCandidates);

  if (deduped.length < limit) {
    const existingIds = new Set(deduped.map((p) => p.id));
    const { rows: extraRows } = await pool().query(
      `SELECT ${POST_SELECT} FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.id <> ALL($1::text[])
       ORDER BY p.post_score DESC LIMIT $2`,
      [Array.from(existingIds), (limit - deduped.length) * 4],
    );
    const extraCandidates = deduplicatePosts(extraRows.map(rowToPost), {
      seenIds: existingIds,
    });
    deduped = [...deduped, ...extraCandidates];
  }

  const finalDeduped = deduped.slice(0, limit);

  // Enforce 80/20 Cold-Start Spotlight quota (slots 2 and 7 in a 10-post page)
  if (limit >= 8 && finalDeduped.length >= 8) {
    const { rows: coldRows } = await pool().query(
      `SELECT ${POST_SELECT} FROM posts p JOIN users u ON u.id = p.author_id
       WHERE (u.followers_count = 0 OR p.impressions < 100)
         AND p.proxy_success_rate > 0.3
         AND p.author_id <> $1
       ORDER BY p.usability_score DESC, p.created_at DESC
       LIMIT 8`,
      [userId],
    );
    const coldPosts = deduplicatePosts(coldRows.map(rowToPost));
    const existingIds = new Set(finalDeduped.map((p) => p.id));
    const existingHashes = new Set(finalDeduped.map((p) => computeContentHash(p)));
    const slotPositions = [2, 7];
    let coldCursor = 0;
    for (const slot of slotPositions) {
      while (coldCursor < coldPosts.length) {
        const candidate = coldPosts[coldCursor++]!;
        const cHash = computeContentHash(candidate);
        if (!existingIds.has(candidate.id) && !existingHashes.has(cHash)) {
          finalDeduped[slot] = candidate;
          existingIds.add(candidate.id);
          existingHashes.add(cHash);
          break;
        }
      }
    }
  }

  return finalDeduped;
}

export async function dbGetFollowingIds(userId: string): Promise<string[]> {
  const { rows } = await pool().query(
    "SELECT followee_id FROM follows WHERE follower_id = $1 ORDER BY created_at DESC",
    [userId],
  );
  return rows.map((r) => r.followee_id as string);
}

export async function dbGetFollowersIds(userId: string): Promise<string[]> {
  const { rows } = await pool().query(
    "SELECT follower_id FROM follows WHERE followee_id = $1 ORDER BY created_at DESC",
    [userId],
  );
  return rows.map((r) => r.follower_id as string);
}

export async function dbToggleFollow(
  followerId: string,
  followeeId: string,
  following: boolean,
): Promise<{ ok: boolean; following: boolean }> {
  if (followerId === followeeId) {
    return { ok: false, following: false };
  }
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    if (following) {
      await client.query(
        `INSERT INTO follows (follower_id, followee_id, created_at)
         VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
        [followerId, followeeId],
      );
      await client.query(
        `INSERT INTO events (id, user_id, target_user_id, type, value, created_at)
         VALUES ($1, $2, $3, 'follow', 0.4, NOW()) ON CONFLICT DO NOTHING`,
        [`evt_follow_${Date.now().toString(36)}`, followerId, followeeId],
      );
      // Taste-vector nudge toward followed builder's intent embedding
      const { rows: vecRows } = await client.query(
        `SELECT
           (SELECT intent_embedding::text FROM users WHERE id = $1) AS follower_vec,
           (SELECT intent_embedding::text FROM users WHERE id = $2) AS followee_vec`,
        [followerId, followeeId],
      );
      const fv = parseVec(vecRows[0]?.follower_vec);
      const tv = parseVec(vecRows[0]?.followee_vec);
      if (tv) {
        const nudged = updateEmaVector(fv, tv, "SINGLE");
        await client.query(
          "UPDATE users SET intent_embedding = $1::vector WHERE id = $2",
          [toVec(nudged), followerId],
        );
      }
    } else {
      await client.query(
        "DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2",
        [followerId, followeeId],
      );
    }

    await client.query(
      `UPDATE users SET following_count = (SELECT COUNT(*) FROM follows WHERE follower_id = $1) WHERE id = $1`,
      [followerId],
    );
    await client.query(
      `UPDATE users SET followers_count = (SELECT COUNT(*) FROM follows WHERE followee_id = $1) WHERE id = $1`,
      [followeeId],
    );
    await client.query("COMMIT");
    return { ok: true, following };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function dbFollowingFeed(userId: string, limit = 10, offset = 0): Promise<Post[]> {
  const { rows } = await pool().query(
    `SELECT ${POST_SELECT}
     FROM posts p
     JOIN users u ON u.id = p.author_id
     WHERE p.author_id IN (SELECT followee_id FROM follows WHERE follower_id = $1)
       AND p.proxy_success_rate > 0.3
     ORDER BY p.created_at DESC, p.daily_leaderboard_score DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit * 2, offset],
  );
  return deduplicatePosts(rows.map(rowToPost)).slice(0, limit);
}

/** Hybrid Global Search combining Postgres Full-Text Search (tsvector), lexical phrase matching, and pgvector cosine similarity. */
export async function dbSearchGlobalFeed(params: {
  q?: string;
  mode?: DemoMode;
  category?: string;
  verifiedOnly?: boolean;
  limit?: number;
}): Promise<Array<{ post: Post; similarity: number }>> {
  const q = params.q?.trim() ?? "";
  const limit = params.limit ?? 20;

  if (!q) {
    const conds: string[] = ["p.proxy_success_rate > 0.3"];
    const args: unknown[] = [];
    if (params.mode) {
      args.push(params.mode);
      conds.push(`p.demo_mode = $${args.length}`);
    }
    if (params.category) {
      args.push(params.category.toLowerCase());
      conds.push(`LOWER(p.category) = $${args.length}`);
    }
    if (params.verifiedOnly) {
      conds.push(`p.uptime_pct >= 85 AND p.tries_count >= 20`);
    }
    args.push(limit * 2);
    const { rows } = await pool().query(
      `SELECT ${POST_SELECT}
       FROM posts p JOIN users u ON u.id = p.author_id
       WHERE ${conds.join(" AND ")}
       ORDER BY p.daily_leaderboard_score DESC, p.post_score DESC
       LIMIT $${args.length}`,
      args,
    );
    return deduplicatePosts(rows.map((r) => ({ post: rowToPost(r), similarity: 0.9 }))).slice(0, limit);
  }

  const qVec = toVec(
    computeIntentEmbedding({
      title: q,
      problemStatement: q,
      category: params.category,
    }),
  );

  const conds: string[] = ["p.proxy_success_rate > 0.3"];
  const args: unknown[] = [q, qVec]; // $1 = q, $2 = qVec
  if (params.mode) {
    args.push(params.mode);
    conds.push(`p.demo_mode = $${args.length}`);
  }
  if (params.category) {
    args.push(params.category.toLowerCase());
    conds.push(`LOWER(p.category) = $${args.length}`);
  }
  if (params.verifiedOnly) {
    conds.push(`p.uptime_pct >= 85 AND p.tries_count >= 20`);
  }
  args.push(limit * 2);

  const { rows } = await pool().query(
    `WITH scored AS (
       SELECT ${POST_SELECT},
         CASE
           WHEN p.title ILIKE '%' || $1 || '%'
             OR p.problem_statement ILIKE '%' || $1 || '%'
             OR p.category ILIKE '%' || $1 || '%'
             OR p.tags::text ILIKE '%' || $1 || '%'
           THEN 1.0
           ELSE 0.0
         END AS kw_match,
         LEAST(ts_rank_cd(p.search_tsv, websearch_to_tsquery('english', $1)) * 2.5, 1.0) AS fts_score,
         CASE
           WHEN p.intent_embedding IS NOT NULL
           THEN GREATEST(0.0, 1.0 - (p.intent_embedding <=> $2::vector))
           ELSE 0.5
         END AS vec_sim
       FROM posts p JOIN users u ON u.id = p.author_id
       WHERE ${conds.join(" AND ")}
     )
     SELECT *,
       (0.45 * kw_match + 0.25 * fts_score + 0.30 * vec_sim) AS hybrid_score
     FROM scored
     WHERE kw_match > 0 OR fts_score > 0
     ORDER BY hybrid_score DESC, post_score DESC
     LIMIT $${args.length}`,
    args,
  );

  if (rows.length > 0) {
    return deduplicatePosts(
      rows.map((r) => ({
        post: rowToPost(r),
        similarity: Number(Math.min(0.99, Math.max(0.72, Number(r.hybrid_score) || Number(r.vec_sim) || 0.85)).toFixed(2)),
      })),
    ).slice(0, limit);
  }

  // Semantic pgvector fallback when exact lexical match returns 0 rows
  const { rows: fallbackRows } = await pool().query(
    `SELECT ${POST_SELECT},
       CASE
         WHEN p.intent_embedding IS NOT NULL
         THEN GREATEST(0.0, 1.0 - (p.intent_embedding <=> $1::vector))
         ELSE 0.5
       END AS vec_sim
     FROM posts p JOIN users u ON u.id = p.author_id
     WHERE p.proxy_success_rate > 0.3
     ORDER BY vec_sim DESC, p.daily_leaderboard_score DESC
     LIMIT 12`,
    [qVec],
  );
  return deduplicatePosts(
    fallbackRows.map((r) => ({
      post: rowToPost(r),
      similarity: Number(Math.min(0.95, Math.max(0.7, Number(r.vec_sim) || 0.78)).toFixed(2)),
    })),
  ).slice(0, 5);
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
     ORDER BY ${ORDER[type]} DESC LIMIT 30`,
  );
  const uniquePosts = deduplicatePosts(rows.map(rowToPost)).slice(0, 15);
  const out: LeaderboardRow[] = uniquePosts.map((post, idx) => {
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
            ? `${post.sandboxMultiRuns} deep sandbox sessions · ${post.health.uptimePct}% live reliability`
            : type === "popular"
              ? `${post.sharesCount} community shares · ${post.stats.comments} builder notes`
              : `${post.stats.trialUpvotes} verified sandbox tries · live from Postgres`,
      },
    };
  });
  return { type, period, updatedAt: new Date().toISOString(), rows: out };
}

export type { User };
