import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

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
});
