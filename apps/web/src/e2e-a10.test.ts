import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  SEED_POSTS,
  computeContentHash,
  computeIntentEmbedding,
  computeSimHash64,
  cosineSim,
  deduplicatePosts,
  hammingDistance64,
} from "@arrakis/contracts";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const WEB_ROOT = path.resolve(import.meta.dirname, "..");

describe("A10 — Quality, Accessibility, Motion Performance & E2E Judge Loop", () => {
  it("1. Accessibility Audit (fixing-accessibility): all routes render skip-link, <main id='main-content'>, headings, and alt attributes", async () => {
    const routes = [
      "/",
      "/explore",
      "/create",
      "/ranks",
      "/u/ritam",
      "/u/aanya",
      "/p/post_resume_json",
    ];

    for (const route of routes) {
      const res = await fetch(`${BASE_URL}${route}`);
      assert.equal(res.status, 200, `Expected 200 on ${route}, got ${res.status}`);
      const html = await res.text();

      // Verify skip link & main landmark
      assert.ok(
        html.includes('href="#main-content"'),
        `Route ${route} is missing skip link to #main-content`
      );
      assert.ok(
        html.includes('id="main-content"'),
        `Route ${route} is missing <main id="main-content"> landmark`
      );

      // Verify semantic heading exists
      assert.ok(
        /<h[12][\s>]/.test(html),
        `Route ${route} is missing a top-level <h1> or <h2> heading`
      );

      // Verify every <img> tag has an alt attribute
      const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
      for (const tag of imgTags) {
        assert.ok(
          /\balt=/.test(tag),
          `Route ${route} has an <img> tag missing an alt attribute: ${tag}`
        );
      }
    }
  });

  it("2. Motion & Rendering Performance Audit (fixing-motion-performance & baseline-ui): honours prefers-reduced-motion, content-visibility, and avoids layout-thrashing transition-all", () => {
    const css = fs.readFileSync(path.join(WEB_ROOT, "src/app/globals.css"), "utf-8");
    assert.ok(
      css.includes("@media (prefers-reduced-motion: reduce)"),
      "globals.css must honour prefers-reduced-motion: reduce"
    );
    assert.ok(
      css.includes("content-visibility: auto"),
      "globals.css must define .cv-auto content-visibility optimization"
    );

    const reelCard = fs.readFileSync(path.join(WEB_ROOT, "src/components/reel-card.tsx"), "utf-8");
    const leaderboard = fs.readFileSync(
      path.join(WEB_ROOT, "src/components/leaderboard-view.tsx"),
      "utf-8"
    );
    assert.ok(
      !reelCard.includes("transition-all"),
      "reel-card.tsx must not use layout-thrashing transition-all"
    );
    assert.ok(
      !leaderboard.includes("transition-all"),
      "leaderboard-view.tsx must not use layout-thrashing transition-all"
    );
  });

  it("3. E2E Core Judge Loop: Browse Feed → SSRF Preflight → Try Sandbox (SSE) → Telemetry & Micro-Review → Standings Update", async () => {
    // Step A: Browse personalized feed
    const feedRes = await fetch(`${BASE_URL}/api/feed?userId=usr_ritam&limit=5`);
    assert.equal(feedRes.status, 200);
    const feedData = (await feedRes.json()) as { items: Array<{ post: { id: string } }> };
    assert.ok(Array.isArray(feedData.items) && feedData.items.length > 0);

    // Step B: Verify Sandbox SSRF Guard blocks AWS/cloud metadata IP (169.254.169.254)
    const ssrfRes = await fetch(`${BASE_URL}/api/sandbox/preflight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_url: "http://169.254.169.254/latest/meta-data/" }),
    });
    assert.equal(ssrfRes.status, 403);

    // Step C: Launch Try-It Sandbox run
    const tryRes = await fetch(`${BASE_URL}/api/try/post_resume_json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: { sample_input: "Resume PDF test" } }),
    });
    assert.equal(tryRes.status, 201);
    const trialRun = (await tryRes.json()) as { id: string; postId: string };
    assert.ok(trialRun.id.startsWith("run_"));

    // Step D: Stream SSE output from sandbox
    const streamRes = await fetch(
      `${BASE_URL}/api/try/${encodeURIComponent(trialRun.id)}/stream?postId=post_resume_json`
    );
    assert.equal(streamRes.status, 200);
    const sseText = await streamRes.text();
    assert.ok(sseText.includes("event: status"));
    assert.ok(sseText.includes("event: result"));

    // Step E: Submit Outer-Shell Telemetry & 3-Tap Micro-Review
    const telemetryRes = await fetch(`${BASE_URL}/api/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: "post_resume_json",
        user_id: "usr_ritam",
        project_type: "CONTAINER",
        health_ok: true,
        boot_time_ms: 140,
        switched_to_landscape: false,
        active_dwell_seconds: 50,
        interaction_bursts: 4,
        quick_feedback_tag: "WORKS_GREAT",
      }),
    });
    assert.equal(telemetryRes.status, 200);
    const telemetryData = (await telemetryRes.json()) as { ok: boolean; run_tier: string };
    assert.equal(telemetryData.ok, true);
    assert.equal(telemetryData.run_tier, "MULTI");

    const reviewRes = await fetch(`${BASE_URL}/api/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: trialRun.id,
        postId: "post_resume_json",
        worked: true,
        wouldUse: true,
        bug: "Works cleanly on multi-column PDFs",
      }),
    });
    assert.equal(reviewRes.status, 201);

    // Step F: Verify Leaderboard / Standings endpoints across tabs
    for (const type of ["builders", "testers", "trending", "useful", "popular"]) {
      const lbRes = await fetch(`${BASE_URL}/api/leaderboard?type=${type}&period=7d`);
      assert.equal(lbRes.status, 200);
      const lb = (await lbRes.json()) as { rows: Array<{ rank: number; score: number }> };
      assert.ok(lb.rows.length > 0, `Leaderboard ${type} returned 0 rows`);
      assert.equal(lb.rows[0]!.rank, 1);
    }
  });

  it("4. E2E Upload Happy Path: Publish build with YouTube pitch URL → Auto thumbnail → Render deep-link page", async () => {
    const createRes = await fetch(`${BASE_URL}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authorId: "usr_ritam",
        title: "EnvGuard CLI — Catch Missing .env Keys Before Deploy",
        problemStatement:
          "Scans monorepo .env.example files and CI secrets to prevent missing environment variable crashes in production.",
        category: "Developer Tools",
        videoUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
        durationSec: 55,
        demo: {
          mode: "container",
          target: "ghcr.io/ritamghosh1/envguard:latest",
          formSchema: [
            {
              name: "env_content",
              label: ".env Sample",
              type: "text",
              required: true,
              defaultValue: "DATABASE_URL=postgres://localhost:5432/app",
            },
          ],
        },
        tags: ["cli", "env", "devops"],
      }),
    });
    assert.equal(createRes.status, 201);
    const { post } = (await createRes.json()) as {
      post: { id: string; thumbUrl: string; videoUrl: string };
    };
    assert.ok(post.id.startsWith("post_"));
    assert.equal(post.thumbUrl, "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg");

    // Verify the newly published post renders on its deep-link page with YouTube embed & JSON-LD
    const detailRes = await fetch(`${BASE_URL}/p/${encodeURIComponent(post.id)}`);
    assert.equal(detailRes.status, 200);
    const detailHtml = await detailRes.text();
    assert.ok(detailHtml.includes("EnvGuard CLI"));
    assert.ok(detailHtml.includes("youtube-nocookie.com/embed/M7lc1UVf-VE"));
    assert.ok(detailHtml.includes('"@type":"SoftwareApplication"'));
  });

  it("5. Recommender System E2E: Auto-Embedding (16-d pgvector), Following Feed, Follow Toggle, 80/20 Cold-Start Quota, and Hybrid Global Search", async () => {
    // Step A: Verify deterministic 16-d unit vector generation & category clustering
    const pdfVec1 = computeIntentEmbedding({
      title: "Resume PDF to JSON Parser",
      problemStatement: "Extract structured JSON from multi-column resume PDFs",
      category: "Document & PDF",
      tags: ["pdf", "resume", "ocr"],
    });
    const pdfVec2 = computeIntentEmbedding({
      title: "Invoice OCR Extractor",
      problemStatement: "Parse PDF invoices into line-item JSON",
      category: "Document & PDF",
      tags: ["pdf", "invoice"],
    });
    const cliVec = computeIntentEmbedding({
      title: "Docker Port Guard",
      problemStatement: "Find and kill zombie local container ports from terminal",
      category: "Developer Tools",
      tags: ["cli", "docker"],
    });
    assert.equal(pdfVec1.length, 16);
    assert.ok(cosineSim(pdfVec1, pdfVec2) > 0.8, "Same-category vectors should have cosineSim > 0.8");
    assert.ok(
      cosineSim(pdfVec1, pdfVec2) > cosineSim(pdfVec1, cliVec),
      "Same-category similarity must exceed cross-category similarity"
    );

    // Step B: Verify 80/20 Cold-Start Spotlight quota on For-You feed
    const forYouRes = await fetch(`${BASE_URL}/api/feed?userId=usr_ritam&mode=for_you&limit=10`);
    assert.equal(forYouRes.status, 200);
    const forYou = (await forYouRes.json()) as {
      items: Array<{ post: { id: string }; reason: { kind: string; text: string } }>;
    };
    assert.equal(forYou.items.length, 10);
    const coldCount = forYou.items.filter((i) => i.reason.kind === "coldstart").length;
    assert.ok(coldCount >= 2, `Expected at least 2 cold-start slots in 10 items, got ${coldCount}`);

    // Step C: Toggle follow in Postgres and verify Following feed reflects followed builders
    const followRes = await fetch(`${BASE_URL}/api/follow/usr_kabir?followerId=usr_ritam`, {
      method: "POST",
    });
    assert.equal(followRes.status, 200);
    const followData = (await followRes.json()) as { ok: boolean; following: boolean };
    assert.equal(followData.ok, true);
    assert.equal(followData.following, true);

    const followingFeedRes = await fetch(`${BASE_URL}/api/feed?userId=usr_ritam&mode=following`);
    assert.equal(followingFeedRes.status, 200);
    const followingFeed = (await followingFeedRes.json()) as {
      mode: string;
      items: Array<{ post: { authorId: string }; reason: { kind: string } }>;
    };
    assert.equal(followingFeed.mode, "following");
    assert.ok(followingFeed.items.length > 0, "Following feed should return posts from followed builders");
    assert.ok(
      followingFeed.items.every((item) => item.reason.kind === "followed"),
      "Every item in Following feed should have reason.kind === 'followed'"
    );

    // Step D: Verify Postgres Hybrid Global Search (FTS + pgvector cosine similarity + semantic fallback)
    const searchRes = await fetch(`${BASE_URL}/api/feed?mode=global&q=resume%20pdf`);
    assert.equal(searchRes.status, 200);
    const searchFeed = (await searchRes.json()) as {
      mode: string;
      items: Array<{ post: { id: string; title: string }; reason: { kind: string; similarity?: number } }>;
    };
    assert.equal(searchFeed.mode, "global");
    assert.ok(searchFeed.items.length > 0, "Hybrid search should return matching builds");
    assert.equal(searchFeed.items[0]!.reason.kind, "search");
    assert.ok((searchFeed.items[0]!.reason.similarity ?? 0) >= 0.7);
  });

  it("6. Scalable Deduplication & Full-Screen Mobile Snap Feed: 64-bit ContentHash + LSH SimHash collapses clones and guarantees 100% unique feed reels", async () => {
    // Step A: Verify 64-bit ContentHash and SimHash64 collapse near-duplicate clone posts
    const cloneA = {
      ...SEED_POSTS[0]!,
      id: "post_clone_a",
      title: "GitBisect Replay — Find the exact commit (#7)",
      problemStatement: "Automatically replay a curl request against recent git commits in a container.",
    };
    const cloneB = {
      ...SEED_POSTS[0]!,
      id: "post_clone_b",
      title: "GitBisect Replay — Find the exact commit (#19)",
      problemStatement: "Automatically replay a curl request against recent git commits in a container!",
    };
    assert.equal(computeContentHash(cloneA), computeContentHash(cloneB));
    assert.equal(hammingDistance64(computeSimHash64(cloneA), computeSimHash64(cloneB)), 0);

    const collapsed = deduplicatePosts([cloneA, cloneB, SEED_POSTS[1]!]);
    assert.equal(collapsed.length, 2, "Near-duplicate clones must collapse into a single item");

    // Step B: Verify live feed returns 0 duplicate IDs and 0 duplicate contentHashes
    const feedRes = await fetch(`${BASE_URL}/api/feed?userId=usr_ritam&mode=for_you&limit=10`);
    assert.equal(feedRes.status, 200);
    const feed = (await feedRes.json()) as {
      items: Array<{ post: { id: string; title: string; problemStatement: string } }>;
    };
    const seenIds = new Set(feed.items.map((i) => i.post.id));
    const seenHashes = new Set(feed.items.map((i) => computeContentHash(i.post)));
    assert.equal(seenIds.size, feed.items.length, "Feed must not contain duplicate post IDs");
    assert.equal(seenHashes.size, feed.items.length, "Feed must not contain duplicate content hashes");

    // Step C: Verify Home page renders full-screen vertical snap scroller (.feed-scroller + .feed-item h-full w-full)
    const homeHtml = await (await fetch(`${BASE_URL}/`)).text();
    assert.ok(homeHtml.includes("feed-scroller"), "Home feed must use .feed-scroller for vertical snap");
    assert.ok(homeHtml.includes("feed-item h-full w-full"), "Each reel item must be full-height (.feed-item h-full w-full)");
  });
});
