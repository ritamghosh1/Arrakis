# TODOS.md — Task Board

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · 🔗 = depends on other dev · 🤝 = joint
Owners: **Dev A (Ritam)** = UI + Ranking/Leaderboard · **Dev B (Srinjoy)** = Recommendation (FastAPI) + Containerization (TS/Docker). Details: [PLANS.md](./PLANS.md).

---

## 🤝 M0 — Joint Setup (do together first)
- [x] 🤝 Pick final stack (TS monorepo for Web/Sandbox/Scoring + Python FastAPI for Recommender, Drizzle ORM + Postgres/pgvector + Redis) and init workspace
- [x] 🤝 Create folder layout (`apps/web`, `services/recommender`, `services/sandbox`, `services/scoring`, `packages/contracts`, `infra`)
- [x] 🤝 Write & **freeze contracts v0** (`packages/contracts/src/types.ts`, `services/recommender/app/contracts.py`, `packages/contracts/openapi.yaml`)
- [x] 🤝 `infra/docker-compose.yml` (`pgvector/pgvector:pg16`, `redis:7-alpine`) + `infra/init.sql`
- [x] 🤝 DB schema + migrations (`packages/contracts/src/db/schema.ts` with Drizzle ORM + `infra/migrations/0000_init.sql`)
- [x] 🤝 Seed script `npm run seed` / `pnpm seed` (30 users / 60 posts / 200 follows / 50 events in `infra/seed/*.json`) + demo personas (`@ritam`, `@srinjoy`, `@aanya`, `@kabir`, `@devika`)
- [x] 🤝 `.env.example`, `.gitignore`, lint/format/typecheck scripts, GitHub Actions CI (`.github/workflows/ci.yml`)
- [x] 🤝 Mock mode (`MOCK=1`) convention implemented in `packages/contracts/src/mocks/seed-data.ts` and wired into all service entrypoints
- [x] 🤝 Push to `origin main` (https://github.com/ritamghosh1/Arrakis)

---

## 👤 DEV A (Ritam) — UI + Ranking & Leaderboard

### A1. Design foundation (M0–M1)
- [ ] Run `ui-skills-root`; generate `DESIGN.md` via `create-design-md` (palette: dune/ember/ink/sage, type scale, spacing, radii, motion tokens)
- [ ] Original brand: name lockup, icon set (own/OSS licensed — **not** Instagram assets), favicon, OG image
- [ ] Tailwind config with tokens; z-index scale; `h-dvh`, safe-area utilities
- [ ] Base components: Button, IconButton (aria-label), Chip, Avatar, Badge, Skeleton, Toast, Sheet(`<dialog>`), Popover, Tabs
- [ ] Run `modern-web-guidance search` for each feature below before coding; note guide IDs in PR

### A2. App shell & navigation
- [ ] Bottom nav (Home · Explore · Create · Ranks · Me) → left rail ≥1024px
- [ ] Route structure: `/`, `/explore`, `/create`, `/ranks`, `/u/[handle]`, `/p/[id]`
- [ ] View Transitions between tabs & feed→post (`same-document-transitions` / `cross-document-transitions`)
- [ ] Keyboard shortcuts (`j/k/t/u//`) + focus management
- [ ] PWA manifest, install prompt, offline shell (cut-list #3)

### A3. Home feed (recommended)
- [ ] Snap-scroll reel container (`scroll-snap-state-sync`) + IntersectionObserver play/pause/preload
- [ ] `lazy-load-video-and-audio`: poster-first, release off-screen media
- [ ] Post card: video, problem-statement card, author row, action rail (Upvote · Comment · Save · Share), **Try it** dock
- [ ] 🔗 **Reason chip** rendering from `FeedItem.reason` ("Recommended because you follow @x", taste, cold-start, trending)
- [ ] "For you" ↔ "Following" toggle
- [ ] "Fresh Builds" rail with uptime ring
- [ ] Infinite pagination (cursor), pull-to-refresh, skeletons, error/empty states
- [ ] Optimistic upvote/save/follow with rollback
- [ ] Batched `POST /events` (view dwell, try, share) with `sendBeacon`

### A4. Global feed / Explore
- [ ] Problem-first search bar with debounced query + recent searches
- [ ] 🔗 Result cards with similarity "why" label
- [ ] Filters & sort (mode, category, Verified only; Trending/New/Most-tried)
- [ ] Trending problem chips; empty-results suggestion state

### A5. Try-It overlay (UI) — 🔗 Dev B sandbox
- [ ] Bottom-sheet `<dialog>` (`dialog`, `light-dismiss-a-dialog`, `prevent-page-scroll-under-modal-dialog`)
- [ ] Auto-generated form from `formSchema` (validation after interaction)
- [ ] SSE terminal component (ANSI-safe render, auto-scroll, copy, 1 MB cap)
- [ ] Web-mode sandboxed iframe viewer + "open on laptop" button
- [ ] State machine UI: queued(position) → starting → running → done/timeout/rate-limited/failed(+retry)
- [ ] 3-tap micro-review + XP toast → `POST /reviews`
- [ ] Health Card (p50/p95 latency, uptime %, crash rate) on post detail

### A6. Share
- [ ] Share sheet: Web Share API (feature-detect) → copy link, QR, email, "Send to laptop"
- [ ] Deep-link page `/p/[id]` with metadata/OG/JSON-LD (`fixing-metadata`)
- [ ] Emit `share` events

### A7. Upload / Create form
- [ ] Step 1 Pitch video: drag-drop/record, ≤120 s check, type/size validation, preview, progress (signed upload)
- [ ] Step 2 Basics: title, **problem it solves** (required), category, tags
- [ ] Step 3 Demo wiring: mode radio (URL/API/Container/CLI), URL validation, **form-schema builder** with live preview
- [ ] Step 4 Review & publish: AI-extracted statement (editable), consent, submit, success + share CTA
- [ ] Validation UX per `validate-input-after-interaction` (`:user-invalid`), proper `autocomplete/inputmode/type`
- [ ] Draft autosave (IndexedDB), accessible error summary
- [ ] `POST /posts` + 🔗 indexing status polling ("Indexing…" → prefilled)

### A8. Profile
- [ ] Header (avatar, handle, role, bio, counts, badges, XP/rank)
- [ ] 🔗 Follow/Following button (optimistic) + followers/following lists
- [ ] Tabs: Projects (project shelf w/ telemetry) · Tried · Reviews
- [ ] Edit profile; builder dashboard (tries, conversions, feedback inbox)

### A9. Ranking & Leaderboard (`services/scoring`)
- [ ] Implement `PostScore` (weighted votes 3×, trialRate, quality, decay) + unit tests (golden cases)
- [ ] Anti-gaming: ignore self-events, one vote/user/post, require completed run for reviews, IP/device clustering discount, mutual-vote ring dampening
- [ ] Builder score + Verified Utility badge (>85% uptime, ≥20 runs)
- [ ] Tester XP engine (try +10, review +25, first-25 +100, bug confirmed +50), levels, badges
- [ ] Event consumer (Redis stream/poll) with idempotent incremental updates + `rebuild-from-events`
- [ ] Redis ZSET leaderboards (builders/testers/trending × periods) + daily snapshot for ▲▼ deltas
- [ ] `GET /leaderboard`, `GET /users/:id/profile` (rank, XP, badges)
- [ ] Leaderboard UI: tabs, period filter, podium, rows with delta, "why this rank" popover, pinned "You" row, `aria-live`
- [ ] Badge gallery component + XP/level-up toast

### A10. Quality (M4)
- [ ] `fixing-accessibility` audit on every screen; fix findings
- [ ] `fixing-motion-performance` audit (feed, transitions); honour reduced motion
- [ ] `baseline-ui` polish pass; `improve-ui` review → plan → fixes
- [ ] Perf: LCP<2.5s, INP<200ms, CLS<0.1 (`performance` guide); `content-visibility` on lists
- [ ] Responsive QA (360px, 768px, 1280px+), Safari/Chrome/Firefox check
- [ ] Playwright e2e: browse→try→review→leaderboard; upload happy path

---

## 👤 DEV B (Srinjoy) — Recommendation Engine (FastAPI) + Containerization

### B1. Data & infra (M0–M1)
- [ ] Postgres schema for `follows`, `events`, `post_embeddings` (pgvector + HNSW/IVFFlat index), `taste_vectors`
- [ ] Event ingest `POST /events` (batch, validation, dedupe, async write)
- [ ] Mock server serving seed JSON per contract (unblocks Dev A — **do first**)
- [ ] Embedding utility with fallback (OpenAI → local model → seeded vectors)

### B2. Follow system
- [ ] `POST/DELETE /follow/:userId` (idempotent, no self-follow), counts cache
- [ ] `GET /users/:id/followers|following` with pagination
- [ ] `GET /suggestions/users` (followed-by-my-follows + topical affinity + top builders)
- [ ] Follow → taste-vector nudge + `follow` event

### B3. Recommendation engine
- [ ] Taste vector updater with decay & weights (watch .2, try .6, review 1.0, share .4)
- [ ] Candidate generators: followed_recent, taste ANN, coldstart pool, trending
- [ ] Scoring blend (cos, social boost, quality, freshness, penalties) with tunable config
- [ ] 80/20 mixer (2 of 10 cold-start slots) + MMR diversity + seen-dedupe
- [ ] **Reason attribution** (`followed` with `via`, 2nd-degree "@x tried this", taste, coldstart, trending) in `FeedItem`
- [ ] `GET /feed/home` (For-you) + `?mode=following`; cursor pagination, stable ordering
- [ ] `GET /feed/global` hybrid search: FTS + vector + RRF; returns similarity & matched phrase
- [ ] Onboarding cold-start: category picks → initial taste vector
- [ ] `GET /feed/debug?userId=` (sources, scores) for judges
- [ ] Offline eval on seeded personas: hit@10 vs random vs trending; document in `services/recommender/EVAL.md`
- [ ] Unit tests: attribution correctness, 80/20 quota, no self-recommendation, seen-dedupe

### B4. AI indexing pipeline
- [ ] Upload hook → audio extract (ffmpeg) → Whisper (or mock transcript)
- [ ] LLM utility extractor prompt (problem/for whom/no buzzwords) with JSON-schema output
- [ ] Embedding → store; status field (`pending|ready|failed`) + retry
- [ ] Mock mode: heuristic from title/description

### B5. Containerized Try-It (`services/sandbox`)
- [ ] Orchestrator skeleton with `SANDBOX_DRIVER=docker|mock`; hello-world container run end to end
- [ ] `POST /try/:postId` → `TrialRun` + `GET /try/:runId/stream` SSE (`log|status|result|health`)
- [ ] Hardened container flags (non-root, read-only, `--cap-drop ALL`, no-new-privileges, pids/mem/cpu caps, tmpfs)
- [ ] Isolated egress-filtered Docker network; block metadata/private ranges
- [ ] TTL reaper (60 s hard, 20 s idle) + startup orphan cleanup by label
- [ ] Global concurrency semaphore + queue position + 429/Retry-After
- [ ] Auto-form → argv/env/body mapping with server-side validation
- [ ] **Mode A** API/CLI proxy: SSRF guard, 10 s timeout, Redis rate limit, redirect-safe
- [ ] **Mode B** web: CSP/`frame-ancestors` headers guidance + iframe `sandbox` config doc; reverse-proxy `/sandbox/<runId>/` for container HTTP apps
- [ ] **Mode C** handoff: email/WebPush "Send to laptop" (fallback: copy link)
- [ ] Build worker: repo+Dockerfile → BuildKit with size/time caps → tag `arrakis/<postId>:<sha>` → `ready` status (cut-list #2: prebuilt images only)
- [ ] Warm pool for popular images (cut-list #2)
- [ ] Output sanitization + 1 MB cap
- [ ] Telemetry: latency, exit code, HTTP status, crash flag → `trial_runs` + health aggregates
- [ ] 3–4 demo images: JSON-resume parser (API), CSV cleaner (CLI), tiny web tool, intentionally-slow app (to demo timeout)
- [ ] Threat checklist tests (fork bomb, mem bomb, infinite loop, SSRF, big output, orphan cleanup) → `services/sandbox/SECURITY.md`

### B6. Quality (M4)
- [ ] Rate-limit & abuse tests; k6/autocannon load test on feed + try endpoints
- [ ] Graceful degradation: Docker down → mock replay; embeddings down → FTS only
- [ ] `/healthz`, structured logs, simple admin page for live containers
- [ ] Final seed polish so demo persona's feed shows each reason type

---

## 🔗 Integration Checkpoints (both)
- [ ] **CP1** (end M1): Web home feed renders Dev B mock `GET /feed/home` incl. Reason chips
- [ ] **CP2** (end M2): Real recommender + real sandbox (docker driver) wired into UI; follow→feed changes visible
- [ ] **CP3** (end M3): `try → review → event → score → leaderboard` works end-to-end live
- [ ] **CP4** (M4): Full demo run on a clean machine from README quick start
- [ ] **CP5** (M5): Rehearse demo script x2; record backup video; tag release `v1-hackathon`

## 📦 Submission
- [ ] README screenshots/GIFs, architecture diagram, "how to run" verified
- [ ] Pitch deck alignment with [transcript.md](./transcript.md) (add containerization + follow-graph slides)
- [ ] Public demo URL or video fallback
- [ ] Open-source license, credits (icon/font/video licenses)
