# PLANS.md — Detailed Plan for Arrakis (2 Developers, Parallel Tracks)

Owners: **Dev A** = UI + Ranking/Leaderboard · **Dev B** = Recommendation + Containerization.
Tracks are decoupled by **contracts + mock mode** (§1). Checklists live in [TODOS.md](./TODOS.md).

---

## 0. Timeline & Milestones

| Block | Dev A | Dev B | Sync / Checkpoint |
|-------|-------|-------|-------------------|
| **M0** Setup (0–1h) | Scaffold `apps/web`, design tokens, DESIGN.md | Scaffold services, docker-compose, DB schema + seed | **Together:** freeze contracts v0, repo skeleton, seed data |
| **M1** Skeleton (1–5h) | App shell, Feed (mock), Post card, Try-it overlay shell | Follow graph API, feed API (mock+real basic), sandbox runner (hello-world container) | Checkpoint 1: web renders feed from Dev B's mock API |
| **M2** Core (5–12h) | Global feed + search UI, Upload form, Profile, Share | Taste vector + attribution, hybrid search, sandbox modes A/B/C + SSE | Checkpoint 2: real recommender + real sandbox plugged into UI |
| **M3** Scoring (12–18h) | Proof-of-Trial scoring, leaderboard UI, badges/XP | Telemetry events emission, health card data, cold-start boost | Checkpoint 3: event → score → leaderboard end-to-end |
| **M4** Polish (18–22h) | a11y + motion pass, perf (LCP/INP), empty/error states | Hardening, rate limits, load test, failure fallbacks | Full demo rehearsal x2 |
| **M5** Freeze (22–24h) | Bug bash, README screenshots | Bug bash, seed final data | Record backup demo video |

> Adjust hours to the actual hackathon length; keep ordering and checkpoints.

---

## 1. Shared Contracts (`packages/contracts`) — FREEZE AT M0

Core entities: `User`, `Post`, `Follow`, `Event`, `TrialRun`, `Review`, `Score`.

```ts
Post   { id, authorId, title, problemStatement, videoUrl, thumbUrl, durationSec,
         demo: { mode: 'api'|'web'|'container'|'handoff', target: string, formSchema?: JSONSchema },
         tags?: string[], createdAt, stats: { views, tries, upvotes, trialUpvotes, comments } }
FeedItem { post: Post, reason: Reason }
Reason   { kind: 'followed'|'taste'|'coldstart'|'trending'|'search', via?: UserRef, text: string }  // "Recommended because you follow @aanya"
Event    { userId, postId, type: 'view'|'try'|'review'|'upvote'|'share'|'follow', value?: number, ts }
TrialRun { id, userId, postId, mode, status, latencyMs, httpStatus?, error?, startedAt }
Review   { runId, worked: boolean, wouldUse: boolean, bug?: string }
```

### REST endpoints (owner → consumer)
| Endpoint | Owner | Consumer |
|---|---|---|
| `GET /feed/home?cursor=` → `FeedItem[]` | B | A |
| `GET /feed/global?cursor=&q=` → `FeedItem[]` (hybrid search) | B | A |
| `POST /follow/:userId`, `DELETE /follow/:userId`, `GET /users/:id/followers\|following` | B | A |
| `GET /suggestions/users` (who to follow) | B | A |
| `POST /events` (batch, fire-and-forget) | B (ingest) | A |
| `POST /posts` (upload metadata) / `POST /uploads/sign` | A | — |
| `POST /try/:postId` → `{ runId, streamUrl }`; `GET /try/:runId/stream` (SSE) | B | A |
| `POST /reviews` | A | — |
| `GET /leaderboard?type=builders\|testers\|trending&period=` | A | A |
| `GET /users/:id/profile` | A | A |

**Mock mode:** every service honors `MOCK=1` serving `infra/seed/*.json`; Dev A develops against `packages/contracts/mocks`.

---

## 2. Pillar 1 — UI / UX  (Dev A)

### 2.1 Design direction — "inspired by Instagram, not a copy"
Borrow *behaviours* users already know; make the *look and structure* ours.

| Pattern (familiar) | Arrakis original treatment |
|---|---|
| Vertical snap reels | Full-bleed demo reel with a **persistent bottom "Try it" dock** (primary CTA) and a collapsible **problem-statement card** ("What it solves") overlaid instead of caption-only |
| Story rail | **"Fresh Builds" rail** of project orbs showing live-uptime ring (green = healthy demo) — not user avatars |
| Like/Comment/Share rail | **Action rail**: Upvote (shows ✓ "tried" variant worth 3×), Comment, Save, Share |
| Profile grid | **Project shelf**: cards with uptime %, tries count, Verified Utility badge, not a photo grid |
| Heart | Replaced by "Worked for me" micro-review |
| Gradient brand | Dune palette (sand, ember orange, deep ink, sage success), distinct display typeface, squarish-rounded geometry |
| Tab bar | Bottom nav: **Home · Explore (Global) · Create · Ranks · Me** |

Run `create-design-md` early → `DESIGN.md` (tokens: colors, type scale, spacing, radii, elevation, motion). Use `baseline-ui` rules (no `h-screen` → `h-dvh`, `text-balance`, `tabular-nums`, safe-area insets, `size-*`, fixed z-index scale, animation ≤200 ms, only compositor props).

### 2.2 Screens & behaviour

**A. App shell / navigation**
- Bottom nav (mobile) → left rail (≥1024px). Same-document **View Transitions** between tabs/profile (guide: `same-document-transitions`); cross-document where MPA (`cross-document-transitions`).
- Keyboard: `j/k` next/prev reel, `t` try, `u` upvote, `/` focus search.

**B. Home feed (recommended)**
- CSS scroll-snap container; `IntersectionObserver` autoplay/pause, preload next, release off-screen video (guides: `scroll-snap-state-sync`, `lazy-load-video-and-audio`).
- Each card shows the **Reason chip** from `FeedItem.reason`:
  - `followed` → avatar + "Recommended because you follow **@aanya** ✦" (tap → their profile)
  - `taste` → "Matches what you tried: *PDF tools*"
  - `coldstart` → "Fresh builder · boosted" (the 20% guarantee, transparent)
- "Following" filter toggle (only followed builders) vs "For you".
- Skeletons, optimistic upvote/follow, infinite cursor pagination, pull-to-refresh.

**C. Global feed / Explore**
- Problem-first search bar: natural query ("send invoice reminders automatically") → results with *similarity reason*.
- Filters: mode (API/Web/Container), category, "Verified Utility only", sort (Trending / New / Most-tried).
- Masonry/list of **project cards** (not just reels) + trending problems chips.

**D. Try-It overlay (UI side of pillar 3)**
- Native `<dialog>` bottom sheet (guides: `dialog`, `light-dismiss-a-dialog`, `prevent-page-scroll-under-modal-dialog`, `declarative-dialog-popover-control`).
- Mode-specific body: Auto-generated **form** (from `formSchema`) + live **SSE terminal**; **sandboxed iframe** for web; **"Send to laptop"** form.
- On finish: **3-tap micro-review** (Worked? · Would use? · 1-line bug) → XP toast.
- States: queued, starting container, running, timed out, rate-limited, failed (friendly + retry).

**E. Share**
- Share sheet: Web Share API (feature-detected) → fallback: copy link, QR, "Send to laptop" (email), social intents. Deep link `/p/:id` with OG image/metadata (`fixing-metadata` skill).
- Share-with-a-tester-invite: "Try this with me" counts as a `share` event.

**F. Upload / Create (form required)**
Multi-step form with native validation, `:user-invalid` feedback only after interaction (guide `validate-input-after-interaction`), correct `type/inputmode/autocomplete`:
1. **Pitch video** — drag-drop/record; ≤120 s, type/size checks, client preview, resumable upload progress.
2. **Basics** — title (≤80), one-line *problem it solves* (≤160, required), category, tags (optional).
3. **Demo wiring** — mode radio: *Live URL (web)* · *API endpoint* · *Container image/repo+Dockerfile* · *CLI*; URL validation; for API/CLI a **form-schema builder** (add fields: name/type/required) with live preview.
4. **Review & publish** — shows AI-extracted problem statement (editable), consent checkbox, submit with progress + success screen with share CTA.
- Save draft locally (`localStorage`/IndexedDB); accessible error summary.

**G. Profile**
- Header: avatar, handle, role (Builder/Tester), bio, **Follow/Following** button, follower/following counts (tap → list), badges (Scout, Verified Utility, Co-Founder tag), XP & rank.
- Tabs: **Projects** (shelf w/ telemetry: uptime %, tries, avg latency), **Tried** (what they validated), **Reviews**.
- Own profile: edit, dashboard link (telemetry & feedback inbox).

**H. Leaderboard (UI side of pillar 4)**
- Tabs: **Builders · Testers (Scouts) · Trending projects**; period filter (24h/7d/all).
- Top-3 podium, then ranked rows with delta arrows (▲▼ vs yesterday), score breakdown popover ("why this rank?"), "You" row pinned.
- Realtime-ish updates (poll 15 s or SSE) with `aria-live="polite"`.

### 2.3 Non-functional UI
- Targets: LCP < 2.5 s, INP < 200 ms, CLS < 0.1 (`performance` guide); `content-visibility:auto` for long lists.
- `prefers-reduced-motion` honoured; no autoplay audio; captions track slot.
- PWA: manifest, install prompt, offline shell + cached last feed.
- a11y: run `fixing-accessibility` on each screen; motion: `fixing-motion-performance`.
- Final `baseline-ui` + `improve-ui` pass.

---

## 3. Pillar 2 — Recommendation Engine  (Dev B)

### 3.1 Signals & data
- `events` (view/try/review/upvote/share/follow) → weights from deck: **Watch +0.2 · Try +0.6 · Feedback +1.0** (also share +0.4, upvote-after-try +1.0 vs passive upvote +0.3).
- Post embedding: `text-embedding-3-small` of AI-extracted **problem statement** (+ title) in `pgvector`.
- **User taste vector** `u ← normalize(0.9·u + w·e_post)` (exponential decay), per-category affinity counters.
- Social graph: `follows(follower_id, followee_id, created_at)`.

### 3.2 Pipeline (feed assembly)
```
candidates = union(
  followed_recent   (posts by followed builders, last N days)        -> reason: followed(via)
  taste_ann         (pgvector ANN around taste vector, top K)        -> reason: taste
  coldstart_pool    (builders with 0–N followers, low exposure)      -> reason: coldstart
  trending          (Proof-of-Trial velocity)                        -> reason: trending
)
score = α·cos(taste, post) + β·socialBoost(followed) + γ·quality(trialScore, uptime)
        + δ·freshness − ε·alreadySeen − ζ·authorRepeatPenalty
final = mix 80% ranked / 20% coldstart (hard quota per page of 10 → 2 coldstart)
re-rank for diversity (MMR) and dedupe seen
```
- **Attribution:** whichever candidate source contributed most, keep `Reason`. For followed: `via` = the followed user. If a post is liked/tried by someone the viewer follows → `kind:'followed'`, text "Recommended because @x tried this" (2nd-degree social proof).
- **Cold start (new user):** onboarding picks 3 problem categories + "who to follow" suggestions (top builders by trial score, topical overlap, mutual follows).
- **Following feed:** strictly followed users, chronological + quality tiebreak.

### 3.3 Search (Global feed)
- Hybrid: Postgres FTS **BM25-ish (`ts_rank_cd`)** + cosine over problem-statement embeddings, fused with Reciprocal Rank Fusion. Query → embedding; return similarity + matched-phrase for the "why" label.
- Fallback when no OpenAI key: local `bge-small`/precomputed seed embeddings or pure FTS.

### 3.4 Follow system
- Follow/unfollow idempotent, counts denormalized + cached; "who to follow" = collaborative (followed-by-my-follows) + topical affinity; block self-follow.
- Emit `follow` event → boosts that builder's content in taste vector (+0.5 of their posts' mean embedding).

### 3.5 Evaluation (hackathon-sized)
- Offline: seed 30 users / 60 posts with planted preferences; show hit@10 vs random & vs trending baseline (follow `ml-best-practices`).
- Debug endpoint `GET /feed/debug?userId=` to show candidate sources + scores — great for judges.

---

## 4. Pillar 3 — Containerized "Try It"  (Dev B)

### 4.1 Modes (from deck + containerization)
| Mode | Use | Isolation |
|---|---|---|
| **A. API/CLI proxy** | Live API/CLI | Edge proxy: SSRF guard, 10 s timeout, Upstash/Redis rate limit, SSE terminal |
| **B. Web app** | Hosted UI | `<iframe sandbox>` bottom sheet, frame-busting safe, CSP |
| **C. Desktop handoff** | Heavy tools | "Send to Laptop" via Resend / WebPush |
| **D. Container (flagship)** | Repos with Dockerfile / prebuilt image, no hosted link | Ephemeral Docker container per run |

### 4.2 Sandbox Orchestrator (`services/sandbox`)
```
POST /try/:postId ─► authz + rate limit ─► create TrialRun(queued)
   └► scheduler: pick warm image / pull (allowlist registry) ─► docker create
        flags: --user 10001 --read-only --tmpfs /tmp --cap-drop ALL
               --security-opt no-new-privileges --pids-limit 128 -m 256m --cpus 0.5
               --network arrakis-sandbox (egress-filtered) --label run=<id> --rm
   └► start ─► attach stdout/stderr ─► SSE /try/:runId/stream (events: log, status, result, health)
   └► TTL reaper (60 s hard kill, + idle 20 s) ─► remove container ─► finalize TrialRun + telemetry
```
- **Build path:** builder gives `repo + Dockerfile` or image → async **build worker** (BuildKit, size/time cap) → image tagged `arrakis/<postId>:<sha>` → status `ready`. Warm-pool of 1 container for popular posts for <1 s start.
- **Interaction:** container exposes either (1) a CLI entry (`argv` from auto-form), or (2) an HTTP port which the orchestrator reverse-proxies at `/sandbox/<runId>/` (shown in iframe).
- **Auto-Form:** `formSchema` → args/env/body mapping; validated server-side.
- **Telemetry:** record start latency, exit code, HTTP status, crash flag → `TrialRun` → "Scalability Health Card" (p50/p95, uptime %, crash rate).
- **Concurrency/backpressure:** global semaphore (e.g. 8 containers), queue with position feedback, 429 with retry-after.
- **Dev fallback:** `SANDBOX_DRIVER=docker|mock|process-disabled`; mock streams a canned terminal so UI work is never blocked.
- **Future (roadmap):** Firecracker/gVisor/WebContainers for stronger isolation — note in README, don't build.

### 4.3 Threat checklist (must pass before demo)
- [ ] Cannot reach host network / metadata IP / other containers
- [ ] Fork-bomb & memory bomb contained by limits
- [ ] Infinite loop killed at TTL
- [ ] Large output truncated (1 MB cap) and sanitized (ANSI/HTML-escaped)
- [ ] Private-IP / `file://` / redirect SSRF blocked in proxy
- [ ] No container left behind after crash (reaper on startup)

---

## 5. Pillar 4 — Ranking & Leaderboard  (Dev A)

### 5.1 Proof-of-Trial (anti-clout) formula
Per post, per time-decay window:
```
weightedVotes = Σ upvote_i × (3 if voter has a TrialRun for this post else 1)
trialRate     = uniqueTesters / uniqueViewers          (conversion)
quality       = 0.5·workedRate + 0.3·uptime(≥85% → bonus) + 0.2·(1 − crashRate)
PostScore     = log(1 + weightedVotes) · (0.5 + quality) · (1 + 0.3·trialRate) · decay(age, halfLife=7d)
```
- Anti-gaming: one weighted vote per user/post; reviewers need a *completed* run (≥ 3 s, exit/200); same-IP/ device fingerprint clustering discount; vote-ring detection (mutual-only voting) dampening; builders can't boost own posts (self-events ignored).
- **Builder score** = Σ top-5 PostScores + 0.2·follower-quality (followers with ≥1 trial) + uptime consistency; **Verified Utility** badge at >85% uptime over ≥20 runs.
- **Tester (Scout) XP:** Try +10, completed review +25, first-25 Scout bonus +100, "bug confirmed by builder" +50; level thresholds; badges: Scout, Bug Hunter, Streak; rewards listed (beta keys/credits as flavour).

### 5.2 Implementation (`services/scoring`)
- Consume `events` + `TrialRun` + `Review` (from Dev B) via DB table polling/Redis stream.
- Worker recomputes affected `PostScore`/`BuilderScore` incrementally; writes to Postgres + **Redis ZSETs** (`lb:builders:7d`, `lb:testers:all`, `lb:trending:24h`) for O(log n) rank reads; daily snapshot for ▲▼ deltas.
- `GET /leaderboard` returns rows + breakdown (`why this rank`), `me` row with rank/percentile.
- Recompute is idempotent (rebuild-from-events command) — useful for seed/demo.
- Unit tests for the formula with golden cases (self-vote ignored, 3× weight, decay).

### 5.3 UI hand-off
Podium, rows with delta, breakdown popover, "You" pinned, badges gallery on profile, XP toast after review.

---

## 6. Cross-cutting

- **AI Indexing pipeline (shared, Dev B owns):** upload → audio extract → Whisper → LLM "utility extractor" (prompt: *what problem does this solve, for whom, no buzzwords*) → embedding → `posts.problem_statement/embedding`. Async job; UI shows "Indexing…" then pre-fills the upload form's review step. Mock: heuristic summary of title.
- **Seed data:** 30 users (builders+testers), 60 posts (mixed modes), 200 follows, 1k events, 300 runs — deterministic script `pnpm seed`; also includes a *demo persona* with a perfect story for the 3-min script.
- **Observability:** structured logs, `/healthz`, simple admin page for running containers.
- **Risks & mitigations**
  | Risk | Mitigation |
  |---|---|
  | Docker unavailable on demo machine | Mock driver + pre-recorded run replays |
  | Video pipeline cost/time | Use sample mp4s + `<video>` direct; Mux optional |
  | OpenAI key/limits | Precomputed embeddings & transcripts in seed |
  | Merge conflicts | Strict path ownership + contracts PRs |
  | Scope creep | Cut-list below |

## 7. Cut-list (drop in this order if time is short)
1. WebPush/Resend handoff → keep only "copy link".
2. Warm pool & build worker → prebuilt images only.
3. PWA offline.
4. Builder telemetry dashboard (keep Health Card on post).
5. Weighted fraud heuristics beyond self-vote and 3× weight.
**Never cut:** Home feed with attribution chips, follow, Try-it container demo, leaderboard with Proof-of-Trial.

## 8. Definition of "Demo-Ready"
End-to-end: follow a builder → Home feed shows their post with attribution → Try it (container) streams logs → review → leaderboard moves → upload new project → appears in Global feed.
