/**
 * Loads the deterministic seed data into Postgres (idempotent — safe to re-run).
 * Usage: npm run seed:db   (needs DATABASE_URL, defaults to docker-compose creds)
 */
import pg from "pg";
import {
  SEED_FOLLOWS,
  SEED_POSTS,
  SEED_POST_VECTORS,
  SEED_USERS,
  SEED_USER_VECTORS,
} from "./mocks/seed-data.ts";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://arrakis:arrakis_dev@localhost:5432/arrakis";

const vec = (v: number[] | undefined) => (v ? `[${v.join(",")}]` : null);

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");

    for (const u of SEED_USERS) {
      await client.query(
        `INSERT INTO users (id, handle, display_name, avatar_url, role, bio, github_url,
           followers_count, following_count, scout_xp, builder_score, verified_utility,
           cofounder_open, badges, intent_embedding, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::vector,$16)
         ON CONFLICT (id) DO UPDATE SET
           handle=EXCLUDED.handle, display_name=EXCLUDED.display_name, bio=EXCLUDED.bio,
           followers_count=EXCLUDED.followers_count, following_count=EXCLUDED.following_count,
           builder_score=EXCLUDED.builder_score, badges=EXCLUDED.badges`,
        [
          u.id, u.handle, u.displayName, u.avatarUrl, u.role, u.bio, u.githubUrl ?? null,
          u.followersCount, u.followingCount, u.scoutXp, u.builderScore, u.verifiedUtility,
          u.cofounderOpen, JSON.stringify(u.badges), vec(SEED_USER_VECTORS[u.id]), u.createdAt,
        ],
      );
    }

    for (const p of SEED_POSTS) {
      const projectType = p.demo.mode === "web" ? "BROWSER" : "CONTAINER";
      // ON CONFLICT DO NOTHING for posts so re-seeding never wipes live telemetry/scores.
      await client.query(
        `INSERT INTO posts (id, author_id, title, problem_statement, category, video_url, thumb_url,
           duration_sec, demo_mode, demo_target, project_type, target_url, intent_embedding,
           form_schema, tags, indexing_status, views_count, tries_count, upvotes_count,
           trial_upvotes_count, comments_count, impressions, video_completions, sandbox_bounces,
           sandbox_single_runs, sandbox_multi_runs, desktop_handoffs, proxy_success_rate,
           weighted_upvotes, weighted_usability_tags, shares_count, popularity_score,
           usability_score, daily_leaderboard_score, uptime_pct, p50_latency_ms, p95_latency_ms,
           crash_rate, post_score, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::vector,$14::jsonb,$15::jsonb,$16,
           $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,
           $38,$39,$40)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           problem_statement = EXCLUDED.problem_statement,
           category = EXCLUDED.category,
           tags = EXCLUDED.tags`,
        [
          p.id, p.authorId, p.title, p.problemStatement, p.category, p.videoUrl, p.thumbUrl,
          p.durationSec, p.demo.mode, p.demo.target, projectType,
          projectType === "BROWSER" ? p.demo.target : null, vec(SEED_POST_VECTORS[p.id]),
          JSON.stringify(p.demo.formSchema ?? null), JSON.stringify(p.tags), p.indexingStatus,
          p.stats.views, p.stats.tries, p.stats.upvotes, p.stats.trialUpvotes, p.stats.comments,
          p.impressions ?? p.stats.views, p.videoCompletions ?? 0, p.sandboxBounces ?? 0,
          p.sandboxSingleRuns ?? 0, p.sandboxMultiRuns ?? 0, p.desktopHandoffs ?? 0,
          p.proxySuccessRate ?? 1, p.weightedUpvotes ?? 0, p.weightedUsabilityTags ?? 0,
          p.sharesCount ?? 0, p.popularityScore ?? 0, p.usabilityScore ?? 0,
          p.dailyLeaderboardScore ?? 0, p.health.uptimePct, p.health.p50LatencyMs,
          p.health.p95LatencyMs, p.health.crashRate, p.postScore, p.createdAt,
        ],
      );
      await client.query(
        `INSERT INTO post_embeddings (post_id, embedding) VALUES ($1,$2::vector)
         ON CONFLICT (post_id) DO NOTHING`,
        [p.id, vec(SEED_POST_VECTORS[p.id])],
      );
    }

    for (const f of SEED_FOLLOWS) {
      await client.query(
        `INSERT INTO follows (follower_id, followee_id, created_at) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [f.followerId, f.followeeId, f.createdAt],
      );
    }

    await client.query("COMMIT");
    console.log(
      `[arrakis:seed-db] ${SEED_USERS.length} users, ${SEED_POSTS.length} posts, ${SEED_FOLLOWS.length} follows loaded into Postgres`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[arrakis:seed-db] Failed:", err);
  process.exit(1);
});
