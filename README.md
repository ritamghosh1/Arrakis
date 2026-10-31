# Arrakis — Utility-First Social Feed for Indie Projects

> **Team UNEMPLOYEDS** · Team Leader: Srinjoy Mukherjee · AKI HACKS
> Source of truth for product intent: [transcript.md](./transcript.md) (extracted from the pitch deck).

**Problem:** Great indie/student projects die in private repos with zero feedback. Non-technical users can't find, run, or test early-stage tools without touching code.

**Solution:** A short-form, utility-first social feed. Builders post a ≤2-min demo reel + a live URL/API/container. Users discover tools by the *problem they solve*, **try them in one tap inside the feed**, and give structured feedback that powers ranking, rewards and a leaderboard.

---

## Flagship Features

| # | Pillar | What judges will see |
|---|--------|----------------------|
| 1 | **UI / UX** | Home feed (recommended), Global feed, Share, Upload form, Profile, Leaderboard. Instagram-*inspired* interaction model, original visual identity. |
| 2 | **Recommendation Engine** | Dynamic taste vector, hybrid problem-first search, **follow graph**, "Recommended because you follow @x" attribution, 80/20 cold-start boost. |
| 3 | **Containerized "Try It"** | One-tap ephemeral sandbox: Docker containers (API/CLI), sandboxed iframe (web apps), live SSE log terminal, resource limits + auto-teardown. |
| 4 | **Ranking & Leaderboard** | Proof-of-Trial (anti-clout) scoring; builder + tester leaderboards, badges, Scout XP. |

## User Flow (3-tap discovery)
1. **Scroll** the utility feed (vertical snap reels).
2. **Try** — 1-tap launches the sandbox overlay (no install/redirect).
3. **Validate & earn** — 3-tap micro-review → XP, badges, bounties.

## Builder Flow (zero-code onboarding)
Record pitch → provide live URL / API / repo+Dockerfile → pick demo wrapper (WebView / Form Builder / Send-to-Laptop) → AI auto-indexes the problem statement → watch telemetry dashboard.

---

## Architecture (high level)

```
Next.js PWA (UI)  ──►  API routes / Edge  ──►  Postgres + pgvector  (users, posts, follows, events, scores)
      │                       │                 Redis (rate limit, leaderboard ZSETs, queues)
      │                       ├──►  Recommender service (taste vector, follow-graph, ranker)
      │                       ├──►  Sandbox Orchestrator ──► Docker engine (ephemeral containers)
      │                       └──►  Scoring worker (Proof-of-Trial, leaderboard rollups)
      └── Video: Mux / Cloudflare Stream (HLS)   AI: Whisper → LLM extractor → embeddings
```

### Tech stack
- **Frontend (Dev A — Ritam):** Next.js 14/15 (App Router) PWA, TypeScript, Tailwind, native `<dialog>`/Popover, CSS scroll-snap + View Transitions.
- **Scoring & Leaderboard Service (Dev A — Ritam):** TypeScript (`services/scoring`), Proof-of-Trial formula, Redis ZSETs.
- **Recommender Service (Dev B — Srinjoy):** Python **FastAPI** (`services/recommender`), taste vector updater, follow-graph attribution, hybrid BM25 + `pgvector` search.
- **Sandbox Orchestrator (Dev B — Srinjoy):** TypeScript (`services/sandbox`), Docker Engine isolation, live SSE terminal streaming.
- **Data & ORM (Shared):** **Drizzle ORM** (`packages/contracts/src/db/schema.ts`), Postgres 16 + `pgvector` (`pgvector/pgvector:pg16`), Redis 7 (`infra/docker-compose.yml`).
- **AI:** Whisper (transcribe) → LLM utility extractor → `text-embedding-3-small` (with deterministic 16-d seed fallback).

> Hackathon rule: **every external dependency must have a mock/seed fallback** so the demo never breaks offline.

---

## Repo Layout (target)
```
Arrakis/
├─ apps/web/            # Next.js PWA (Dev A)
├─ services/recommender # Taste vector, follow graph, feed API (Dev B)
├─ services/sandbox     # Container orchestrator + SSE streamer (Dev B)
├─ services/scoring     # Proof-of-Trial + leaderboard (Dev A)
├─ packages/contracts   # Shared TS types + OpenAPI (BOTH — single source of truth)
├─ infra/               # docker-compose, seed data, sandbox base images
├─ .agents/skills/      # ui-skills (baseline-ui, fixing-accessibility, ...)
├─ AGENTS.md  PLANS.md  TODOS.md  transcript.md
```

## Docs Map
- [AGENTS.md](./AGENTS.md) — rules for AI agents & humans working in this repo
- [PLANS.md](./PLANS.md) — detailed plan per pillar, ownership, contracts, milestones
- [TODOS.md](./TODOS.md) — checkbox task board split by developer

## Quick Start (once scaffolded)
```bash
pnpm install
docker compose -f infra/docker-compose.yml up -d   # postgres, redis, sandbox daemon
pnpm --filter web dev
pnpm seed                                           # demo posts, users, follows
```

## Demo Script (3 min)
1. Open Home feed → point out *"Recommended because you follow @aanya"* chip.
2. Switch to Global feed → problem search: "convert resume to JSON".
3. Tap **Try it** → container spins up, live terminal streams, result shown.
4. Submit 3-tap review → XP toast → open Leaderboard, see rank move.
5. Upload flow → show AI-extracted problem statement.
