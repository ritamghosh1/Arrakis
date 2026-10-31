-- ============================================================================
-- Arrakis Migration 0002: Hackathons & Hackathon Project Submissions
-- ============================================================================

CREATE TABLE IF NOT EXISTS hackathons (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tag TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  organizer_name TEXT NOT NULL DEFAULT 'Community Organizer',
  website_url TEXT,
  banner_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hackathon_projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  hackathon_id TEXT NOT NULL REFERENCES hackathons(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hackathon_project_unique UNIQUE (hackathon_id, project_id)
);

CREATE INDEX IF NOT EXISTS hackathon_projects_hackathon_idx ON hackathon_projects(hackathon_id);
CREATE INDEX IF NOT EXISTS hackathon_projects_project_idx ON hackathon_projects(project_id);

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS hackathon_id TEXT REFERENCES hackathons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hackathon_name TEXT;

-- Seed initial popular hackathons
INSERT INTO hackathons (id, slug, name, tag, description, organizer_name, website_url, banner_url)
VALUES 
  (
    'hack_arrakis_2026',
    'arrakis-buildathon',
    'Arrakis Flagship Buildathon',
    'arrakis-buildathon',
    'The premier utility-first demo hackathon. Build tools that solve real problems with 1-tap live sandboxes.',
    'Arrakis Core Team',
    'https://arrakis.dev',
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80'
  ),
  (
    'hack_agents_sprint',
    'ai-agents-sprint',
    'AI Agents Global Sprint',
    'ai-agents-sprint',
    'Building autonomous coding assistants, scrapers, and automated browser workflows.',
    'DeepMind / Frontier Lab',
    'https://agents.dev',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80'
  ),
  (
    'hack_indie_weekend',
    'indie-weekend-2026',
    'Indie Hacker 48h Shipathon',
    'indie-weekend',
    '48-hour challenge to build and launch single-purpose dev utilities and micro-SaaS.',
    'Indie Builders Collective',
    'https://indiehackers.com',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&auto=format&fit=crop&q=80'
  )
ON CONFLICT (id) DO NOTHING;
