-- ============================================================================
-- Arrakis Migration 0001: Outer-Shell Telemetry, Dual-Scoring Engine & Hybrid Feed RPCs
-- Adapted for Drizzle ORM + Postgres 16 + pgvector (posts & users tables with TEXT IDs & vector(16))
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add Telemetry & Dual-Scoring Columns to posts (projects) Table
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'BROWSER' CHECK (project_type IN ('BROWSER', 'CONTAINER')),
  ADD COLUMN IF NOT EXISTS target_url TEXT,
  ADD COLUMN IF NOT EXISTS intent_embedding vector(16),
  ADD COLUMN IF NOT EXISTS impressions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_completions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sandbox_bounces INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sandbox_single_runs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sandbox_multi_runs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desktop_handoffs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proxy_success_rate DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS weighted_upvotes DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS weighted_usability_tags DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS shares_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS popularity_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS usability_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS daily_leaderboard_score DOUBLE PRECISION NOT NULL DEFAULT 0.0;

CREATE INDEX IF NOT EXISTS posts_intent_embedding_idx
  ON posts USING hnsw (intent_embedding vector_cosine_ops);

-- 2. Add Intent Embedding & Reputation to users (profiles) Table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS intent_embedding vector(16),
  ADD COLUMN IF NOT EXISTS reputation_score DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- 3. Track Impressions to Prevent Duplicate Feed Items
CREATE TABLE IF NOT EXISTS user_impressions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

-- 4. RPC: Atomic Telemetry & Score Updater (Called when user closes sandbox)
CREATE OR REPLACE FUNCTION record_sandbox_telemetry(
  p_project_id TEXT,
  p_user_id TEXT,
  p_health_ok BOOLEAN,
  p_run_tier TEXT, -- 'BOUNCE' | 'SINGLE' | 'MULTI'
  p_tag_delta DOUBLE PRECISION -- +2.0 for WORKS_GREAT, -3.0 for BUGGY, 0.0 for null
)
RETURNS void AS $$
DECLARE
  v_user_rep DOUBLE PRECISION := 1.0;
  v_health_val DOUBLE PRECISION := CASE WHEN p_health_ok THEN 1.0 ELSE 0.0 END;
  prior_c CONSTANT DOUBLE PRECISION := 50.0;
  global_mean_m CONSTANT DOUBLE PRECISION := 1.2;
BEGIN
  -- Fetch user reputation (default 1.0)
  SELECT COALESCE(reputation_score, 1.0) INTO v_user_rep FROM users WHERE id = p_user_id;
  v_user_rep := COALESCE(v_user_rep, 1.0);

  -- Update counters and recompute scores inline for instant hackathon feedback
  UPDATE posts SET
    impressions = impressions + 1,
    tries_count = tries_count + (CASE WHEN p_run_tier IN ('SINGLE', 'MULTI') THEN 1 ELSE 0 END),
    sandbox_bounces = sandbox_bounces + (CASE WHEN p_run_tier = 'BOUNCE' THEN 1 ELSE 0 END),
    sandbox_single_runs = sandbox_single_runs + (CASE WHEN p_run_tier = 'SINGLE' THEN 1 ELSE 0 END),
    sandbox_multi_runs = sandbox_multi_runs + (CASE WHEN p_run_tier = 'MULTI' THEN 1 ELSE 0 END),
    weighted_usability_tags = weighted_usability_tags + (p_tag_delta * v_user_rep),
    -- Exponential moving average for health rate (0.9 old + 0.1 new)
    proxy_success_rate = (0.9 * proxy_success_rate) + (0.1 * v_health_val),
    -- Recompute Popularity Score (Spop)
    popularity_score = (
      weighted_upvotes +
      (0.5 * video_completions) +
      (2.0 * comments_count) +
      (3.0 * shares_count)
    ),
    -- Recompute Usability Score (Suse: Bayesian conversion * health)
    usability_score = ((0.9 * proxy_success_rate) + (0.1 * v_health_val)) * (
      GREATEST(0.0, (
        (-1.0 * (sandbox_bounces + (CASE WHEN p_run_tier = 'BOUNCE' THEN 1 ELSE 0 END))) +
        (3.0 * (sandbox_single_runs + (CASE WHEN p_run_tier = 'SINGLE' THEN 1 ELSE 0 END))) +
        (7.0 * (sandbox_multi_runs + (CASE WHEN p_run_tier = 'MULTI' THEN 1 ELSE 0 END))) +
        (10.0 * desktop_handoffs) +
        (weighted_usability_tags + (p_tag_delta * v_user_rep)) +
        (prior_c * global_mean_m)
      )) / (impressions + 1 + prior_c)
    )
  WHERE id = p_project_id;

  -- Update combined time-decayed leaderboard score
  UPDATE posts SET
    daily_leaderboard_score = (
      (0.4 * LN(GREATEST(popularity_score, 1.0))) +
      (0.6 * usability_score)
    ) / POWER(GREATEST((EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0) + 2.0, 1.0), 1.5)
  WHERE id = p_project_id;

  -- Log impression
  INSERT INTO user_impressions (user_id, project_id)
  VALUES (p_user_id, p_project_id)
  ON CONFLICT (user_id, project_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 5. RPC: Hybrid Personalized Feed Recommender
CREATE OR REPLACE FUNCTION get_personalized_feed(
  p_user_id TEXT,
  p_user_vector vector(16) DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS SETOF posts AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM posts p
  WHERE NOT EXISTS (
    SELECT 1 FROM user_impressions ui
    WHERE ui.user_id = p_user_id AND ui.project_id = p.id
  )
  AND p.proxy_success_rate > 0.3 -- Circuit breaker hides broken demos
  ORDER BY (
    -- 50% Personal Intent Match (Fallback to 0.5 if user has no vector yet)
    (0.50 * COALESCE(1 - (p.intent_embedding <=> p_user_vector), 0.5)) +
    -- 25% Normalized Usability Score
    (0.25 * LEAST(p.usability_score / 5.0, 1.0)) +
    -- 15% Time-Decayed Popularity Score
    (0.15 * LEAST(LN(GREATEST(p.popularity_score, 1.0)) / 10.0, 1.0) /
      POWER(GREATEST((EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600.0) + 2.0, 1.0), 1.2)) +
    -- 10% Cold-Start Exploration Boost (< 100 impressions)
    (0.10 * GREATEST(0.0, (100.0 - p.impressions) / 100.0))
  ) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
