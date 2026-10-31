# AGENTS.md — Working Agreement for Arrakis

Read [README.md](./README.md), [PLANS.md](./PLANS.md), [TODOS.md](./TODOS.md) first. Product intent lives in [transcript.md](./transcript.md).

## Mission
Ship a demo-ready hackathon build of **Arrakis** (utility-first social feed) with four flagship pillars: UI, Recommendation Engine, Containerized Try-It, Ranking/Leaderboard.

## Team & Ownership
Two developers work **in parallel**. Never edit the other's owned paths without a heads-up.

| Owner | Pillars | Paths |
|-------|---------|-------|
| **Dev A** | 1. UI · 4. Ranking & Leaderboard | `apps/web/**`, `services/scoring/**` |
| **Dev B** | 2. Recommendation · 3. Containerization | `services/recommender/**`, `services/sandbox/**`, `infra/**` |
| **Shared** | API contracts | `packages/contracts/**` (PR + both approve) |

## Skills to Use (mandatory)
Located in `.agents/skills/` (ui-skills) and the global modern-web-guidance plugin.

1. **modern-web-guidance** — run FIRST for any HTML/CSS/client-JS work:
   `npx -y modern-web-guidance@latest search "<query>"` then `retrieve "<id>"`.
   Pre-vetted guide IDs for this project: `scroll-snap-state-sync`, `dialog`, `light-dismiss-a-dialog`, `prevent-page-scroll-under-modal-dialog`, `declarative-dialog-popover-control`, `validate-input-after-interaction`, `same-document-transitions`, `cross-document-transitions`, `lazy-load-video-and-audio`, `performance`, `html`.
2. **ui-skills** — `ui-skills-root` to route; `baseline-ui` for polish passes; `fixing-accessibility` before every UI merge; `fixing-motion-performance` for feed/animations; `create-design-md` to produce `DESIGN.md` early; `improve-ui` for review plans.
3. For ML/ranking work follow `ml-best-practices`; for Python deps follow `managing-python-dependencies` (no global `pip install`).

## UI Principles
- **Inspired by Instagram, not a clone.** Borrow *patterns* (vertical snap feed, story-like rail, action rail, profile grid) but use original layout, palette, iconography, naming and motion. No Instagram logo, gradient, font, or exact icon set. Arrakis identity: desert/dune palette, utility-first "Try it" as the primary CTA (not "like").
- Primary action on every post is **Try it**; secondary: Upvote, Comment, Share, Save.
- Accessibility is a ship criterion: keyboard nav, focus states, reduced-motion, ≥4.5:1 contrast, labels on icon buttons.
- Prefer native platform features (`<dialog>`, Popover, scroll-snap, View Transitions, `:user-invalid`) over libraries. Provide fallbacks for non-Baseline features per the guide.
- Mobile-first (PWA), then desktop.

## Engineering Rules
- TypeScript strict. Shared types only from `packages/contracts`.
- API-first: change the contract → mock it → implement. Each service ships with a **mock mode** (`MOCK=1`) returning seeded data so the other dev is never blocked.
- Small PRs (<400 lines), branch names `a/<topic>` or `b/<topic>`, rebase on `main` daily, squash merge.
- Commit style: `feat(feed): ...`, `fix(sandbox): ...`.
- No secrets in git. Use `.env.local`; keep `.env.example` current.
- Preserve existing comments/docs unrelated to your change.

## Security (Sandbox is the risky part)
- Never run user code on the host. Containers: non-root, read-only rootfs, `--cap-drop=ALL`, no-new-privileges, CPU/mem/pids limits, no host mounts, egress-restricted network, hard 60 s TTL, auto-remove.
- Proxy calls: 10 s timeout + rate limit per user/IP. Iframes: `sandbox` attr without `allow-same-origin` unless required.
- Validate all uploads (type, size ≤ limit); never trust URLs — SSRF-guard the proxy (block private IP ranges).

## Definition of Done
- Works in mock mode **and** against real services.
- Lint + typecheck + unit tests pass; one e2e happy-path for the feature.
- `fixing-accessibility` checklist run on any UI change.
- TODOS.md ticked; PLANS.md updated if scope changed.
- Demo-able in the 3-minute script in README.

## Sync Protocol
- 10-min sync at start of each block; contract changes announced immediately in chat.
- Integration checkpoints are listed in PLANS.md §Milestones — do not skip them.
