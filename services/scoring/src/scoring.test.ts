import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SEED_POSTS,
  classifyTelemetryRunTier,
  getMockLeaderboard,
  getQuickFeedbackTagDelta,
  updateEmaVector,
} from "../../../packages/contracts/src/index.ts";
import { computeProofOfTrialScore } from "./index.ts";

describe("Telemetry & Dual-Scoring Engine", () => {
  it("classifies BOUNCE, SINGLE, and MULTI run tiers accurately", () => {
    assert.equal(
      classifyTelemetryRunTier({
        active_dwell_seconds: 3,
        interaction_bursts: 2,
        switched_to_landscape: false,
      }),
      "BOUNCE"
    );
    assert.equal(
      classifyTelemetryRunTier({
        active_dwell_seconds: 20,
        interaction_bursts: 0,
        switched_to_landscape: false,
      }),
      "BOUNCE"
    );
    assert.equal(
      classifyTelemetryRunTier({
        active_dwell_seconds: 20,
        interaction_bursts: 2,
        switched_to_landscape: false,
      }),
      "SINGLE"
    );
    assert.equal(
      classifyTelemetryRunTier({
        active_dwell_seconds: 50,
        interaction_bursts: 3,
        switched_to_landscape: false,
      }),
      "MULTI"
    );
    assert.equal(
      classifyTelemetryRunTier({
        active_dwell_seconds: 45,
        interaction_bursts: 1,
        switched_to_landscape: true,
      }),
      "MULTI"
    );
  });

  it("maps quick_feedback_tag to tag_delta (+2.0, -3.0, 0.0)", () => {
    assert.equal(getQuickFeedbackTagDelta("WORKS_GREAT"), 2.0);
    assert.equal(getQuickFeedbackTagDelta("BUGGY"), -3.0);
    assert.equal(getQuickFeedbackTagDelta(null), 0.0);
  });

  it("updates user intent vector via EMA with alpha=0.15 (SINGLE) and alpha=0.30 (MULTI)", () => {
    assert.deepEqual(updateEmaVector(null, [0.5, 0.5], "SINGLE"), [0.5, 0.5]);
    assert.deepEqual(updateEmaVector([1, 0], [0, 1], "SINGLE"), [0.85, 0.15]);
    assert.deepEqual(updateEmaVector([1, 0], [0, 1], "MULTI"), [0.7, 0.3]);
  });

  it("orders Dual-Score leaderboards (Most Useful, Most Popular, Trending) descending", () => {
    const useful = getMockLeaderboard("useful", "7d", "usr_ritam");
    assert.ok(useful.rows.length > 0);
    assert.ok((useful.rows[0]?.score ?? 0) >= (useful.rows[1]?.score ?? 0));

    const popular = getMockLeaderboard("popular", "7d", "usr_ritam");
    assert.ok(popular.rows.length > 0);
    assert.ok((popular.rows[0]?.score ?? 0) >= (popular.rows[1]?.score ?? 0));

    assert.ok((SEED_POSTS[0]?.usabilityScore ?? 0) > 0);
    assert.ok((SEED_POSTS[0]?.popularityScore ?? 0) > 0);
  });

  it("weights 3x Proof-of-Trial upvotes higher than passive upvotes", () => {
    const passiveScore = computeProofOfTrialScore({
      passiveUpvotes: 30,
      trialUpvotes: 0,
      uniqueViewers: 100,
      uniqueTesters: 10,
      workedRate: 0.9,
      uptimePct: 99,
      crashRate: 0.01,
      ageHours: 12,
    });
    const trialScore = computeProofOfTrialScore({
      passiveUpvotes: 0,
      trialUpvotes: 30,
      uniqueViewers: 100,
      uniqueTesters: 30,
      workedRate: 0.9,
      uptimePct: 99,
      crashRate: 0.01,
      ageHours: 12,
    });
    assert.ok(trialScore > passiveScore);
  });
});
