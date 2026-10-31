-- ============================================================================
-- Arrakis M0 Initial Schema (Postgres 16 + pgvector + Drizzle ORM compatible)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'builder', -- 'builder' | 'tester' | 'both'
  bio TEXT NOT NULL DEFAULT '',
  github_url TEXT,
  followers_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  scout_xp INTEGER NOT NULL DEFAULT 0,
  builder_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  verified_utility BOOLEAN NOT NULL DEFAULT FALSE,
  cofounder_open BOOLEAN NOT NULL DEFAULT FALSE,
  badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Posts (Projects / Demo Reels)
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  category TEXT NOT NULL,
  video_url TEXT NOT NULL,
  thumb_url TEXT NOT NULL,
  duration_sec INTEGER NOT NULL DEFAULT 60,
  demo_mode TEXT NOT NULL, -- 'api' | 'web' | 'container' | 'handoff'
  demo_target TEXT NOT NULL,
  form_schema JSONB,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  indexing_status TEXT NOT NULL DEFAULT 'ready', -- 'pending' | 'ready' | 'failed'
  views_count INTEGER NOT NULL DEFAULT 0,
  tries_count INTEGER NOT NULL DEFAULT 0,
  upvotes_count INTEGER NOT NULL DEFAULT 0,
  trial_upvotes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  uptime_pct DOUBLE PRECISION NOT NULL DEFAULT 99.0,
  p50_latency_ms INTEGER NOT NULL DEFAULT 180,
  p95_latency_ms INTEGER NOT NULL DEFAULT 420,
  crash_rate DOUBLE PRECISION NOT NULL DEFAULT 0.01,
  post_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  search_tsv TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(problem_statement, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(category, '')), 'B')
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_score ON posts(post_score DESC);
CREATE INDEX IF NOT EXISTS idx_posts_search_tsv ON posts USING GIN(search_tsv);

-- 3. Post Embeddings (pgvector 1536-d for text-embedding-3-small, plus 16-d mini vector for offline demo)
CREATE TABLE IF NOT EXISTS post_embeddings (
  post_id TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  embedding vector(16) NOT NULL,
  model TEXT NOT NULL DEFAULT 'seed-16d',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. User Taste Vectors (Dynamic Taste Vector: Watch +0.2 | Try +0.6 | Feedback +1.0)
CREATE TABLE IF NOT EXISTS taste_vectors (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  vector vector(16) NOT NULL,
  category_affinities JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Follows (Social Graph)
CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT no_self_follow CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);

-- 6. Telemetry & Interaction Events
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
  target_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'view' | 'try' | 'review' | 'upvote' | 'share' | 'follow'
  value DOUBLE PRECISION DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_ts ON events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_post_ts ON events(post_id, created_at DESC);

-- 7. Sandbox Trial Runs
CREATE TABLE IF NOT EXISTS trial_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  mode TEXT NOT NULL, -- 'api' | 'web' | 'container' | 'handoff'
  status TEXT NOT NULL, -- 'queued' | 'starting' | 'running' | 'succeeded' | 'timed_out' | 'failed'
  latency_ms INTEGER NOT NULL DEFAULT 0,
  http_status INTEGER,
  exit_code INTEGER,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trial_runs_user_post ON trial_runs(user_id, post_id);

-- 8. 3-Tap Micro-Reviews (Proof-of-Trial)
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES trial_runs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  worked BOOLEAN NOT NULL,
  would_use BOOLEAN NOT NULL,
  bug_note TEXT,
  xp_awarded INTEGER NOT NULL DEFAULT 25,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_post ON reviews(post_id);

-- 9. Leaderboard Daily Snapshots (for rank delta arrows)
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  board_type TEXT NOT NULL, -- 'builders' | 'testers' | 'trending'
  period TEXT NOT NULL,     -- '24h' | '7d' | 'all'
  entity_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  prev_rank INTEGER NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (board_type, period, entity_id)
);
