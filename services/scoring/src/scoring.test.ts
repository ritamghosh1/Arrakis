import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ScoringLedger,
  computeBuilderScore,
  computeProofOfTrialScore,
  computeScoutLevel,
  computeScoutXpForAction,
  evaluateUserBadges,
  isEligibleForVerifiedUtility,
} from "./engine.ts";

describe("Pillar 4 — Proof-of-Trial Scoring & Anti-Gaming Engine", () => {
  it("Golden Case 1: 15 trial-verified upvotes (3x) beat 40 passive drive-by upvotes (1x)", () => {
    const baseMetrics = {
      uniqueViewers: 200,
      uniqueTesters: 35,
      workedRate: 0.92,
      uptimePct: 96,
      crashRate: 0.02,
      ageHours: 24,
    };

    const trialBackedBuildScore = computeProofOfTrialScore({
      ...baseMetrics,
      passiveUpvotes: 0,
      trialUpvotes: 15, // 15 * 3 = 45 weighted votes
    });

    const cloutDriveByBuildScore = computeProofOfTrialScore({
      ...baseMetrics,
      passiveUpvotes: 40, // 40 * 1 = 40 weighted votes
      trialUpvotes: 0,
    });

    assert.ok(
      trialBackedBuildScore > cloutDriveByBuildScore,
      `Expected 15 trial-verified upvotes (${trialBackedBuildScore}) to outrank 40 passive upvotes (${cloutDriveByBuildScore})`
    );
  });

  it("Golden Case 2: Container uptime and crash rate directly impact PostScore", () => {
    const common = {
      passiveUpvotes: 10,
      trialUpvotes: 10,
      uniqueViewers: 100,
      uniqueTesters: 25,
      workedRate: 0.9,
      ageHours: 12,
    };

    const healthyScore = computeProofOfTrialScore({
      ...common,
      uptimePct: 99,
      crashRate: 0.01,
    });
    const flakyScore = computeProofOfTrialScore({
      ...common,
      uptimePct: 45,
      crashRate: 0.55,
    });

    assert.ok(healthyScore > flakyScore);
  });

  it("Golden Case 3: Verified Utility eligibility requires >85% uptime and >=20 runs", () => {
    assert.equal(isEligibleForVerifiedUtility({ uptimePct: 92, totalRuns: 25 }), true);
    assert.equal(isEligibleForVerifiedUtility({ uptimePct: 85, totalRuns: 25 }), false);
    assert.equal(isEligibleForVerifiedUtility({ uptimePct: 98, totalRuns: 19 }), false);
  });

  it("Golden Case 4: BuilderScore caps at top 5 posts to prevent low-effort spam", () => {
    const fiveStrongPosts = computeBuilderScore({
      postScores: [80, 75, 70, 65, 60],
      totalUniqueTesters: 150,
      hasVerifiedUtility: true,
    });
    const fiveStrongPlusSpam = computeBuilderScore({
      postScores: [80, 75, 70, 65, 60, 12, 9, 8, 5, 4],
      totalUniqueTesters: 150,
      hasVerifiedUtility: true,
    });

    assert.equal(fiveStrongPosts, fiveStrongPlusSpam);
  });

  it("Golden Case 5: Scout XP awards First-25 Cold-Start bonus (+100 XP) and calculates levels", () => {
    assert.equal(computeScoutXpForAction({ action: "try_complete", durationMs: 3200 }), 10);
    assert.equal(computeScoutXpForAction({ action: "try_complete", durationMs: 900 }), 0);
    assert.equal(computeScoutXpForAction({ action: "review_submit", postPriorTries: 12 }), 125);
    assert.equal(computeScoutXpForAction({ action: "review_submit", postPriorTries: 40 }), 25);
    assert.equal(computeScoutXpForAction({ action: "bug_confirmed" }), 50);

    const lvl = computeScoutLevel(450);
    assert.equal(lvl.level, 4); // sqrt(450/50) + 1 = 3 + 1 = 4
  });

  it("Anti-Gaming: Ignores self-trials, self-upvotes, and self-reviews", () => {
    const ledger = new ScoringLedger();
    // post_resume_json is authored by usr_aanya
    const selfTrial = ledger.recordCompletedTrial({
      runId: "run_self_1",
      userId: "usr_aanya",
      postId: "post_resume_json",
      durationMs: 4500,
    });
    assert.equal(selfTrial.accepted, false);
    assert.equal(selfTrial.reason, "self_event_ignored");

    const selfVote = ledger.castUpvote({
      userId: "usr_aanya",
      postId: "post_resume_json",
    });
    assert.equal(selfVote.accepted, false);
    assert.equal(selfVote.reason, "self_event_ignored");
  });

  it("Anti-Gaming: Enforces 1 vote per user/post and upgrades 1x passive vote to 3x after trial completion", () => {
    const ledger = new ScoringLedger();

    // 1. User casts passive upvote first (1x)
    const firstVote = ledger.castUpvote({
      userId: "usr_kabir",
      postId: "post_resume_json",
    });
    assert.equal(firstVote.accepted, true);
    assert.equal(firstVote.isTrialVerified, false);
    assert.equal(firstVote.effectiveWeight, 1);

    // 2. Duplicate passive upvote is rejected
    const duplicateVote = ledger.castUpvote({
      userId: "usr_kabir",
      postId: "post_resume_json",
    });
    assert.equal(duplicateVote.accepted, false);
    assert.equal(duplicateVote.reason, "already_voted");

    // 3. Completing a sandbox trial upgrades the existing vote to 3x
    const trialRes = ledger.recordCompletedTrial({
      runId: "run_kabir_upgrade",
      userId: "usr_kabir",
      postId: "post_resume_json",
      durationMs: 3600,
    });
    assert.equal(trialRes.accepted, true);
    assert.equal(trialRes.upgradedVote, true);
  });

  it("Anti-Gaming: Requires completed trial before submitting a review", () => {
    const ledger = new ScoringLedger();

    const rejectedReview = ledger.submitReview({
      runId: "run_fake",
      userId: "usr_devika",
      postId: "post_resume_json",
      worked: true,
      wouldUse: true,
    });
    assert.equal(rejectedReview.accepted, false);
    assert.equal(rejectedReview.reason, "trial_required");

    // Now complete trial and submit review
    ledger.recordCompletedTrial({
      runId: "run_devika_real",
      userId: "usr_devika",
      postId: "post_resume_json",
      durationMs: 3000,
    });
    const acceptedReview = ledger.submitReview({
      runId: "run_devika_real",
      userId: "usr_devika",
      postId: "post_resume_json",
      worked: true,
      wouldUse: true,
    });
    assert.equal(acceptedReview.accepted, true);
    assert.ok(acceptedReview.xpAwarded >= 25);
  });

  it("Anti-Gaming: Discounts IP burst clusters (>5 votes in 60s -> 0.1x weight)", () => {
    const ledger = new ScoringLedger();
    const now = Date.now();
    const voterIds = [
      "usr_ritam",
      "usr_srinjoy",
      "usr_kabir",
      "usr_devika",
      "usr_builder_05",
      "usr_builder_06",
    ];

    const weights: number[] = [];
    for (const uid of voterIds) {
      const res = ledger.castUpvote({
        userId: uid,
        postId: "post_resume_json",
        ipCluster: "203.0.113.42",
        ts: now + 100,
      });
      weights.push(res.effectiveWeight);
    }

    // 6th vote from the same IP within 60s is discounted by 0.1x
    assert.equal(weights[0], 1);
    assert.equal(weights[4], 1);
    assert.equal(weights[5], 0.1);
  });

  it("Badge Evaluation & Idempotent Rebuild-From-Events", () => {
    const badges = evaluateUserBadges({
      hasVerifiedUtilityPost: true,
      earlyColdStartReviews: 6,
      confirmedBugsCount: 4,
      isTop10Builder: true,
      activeDaysStreak: 9,
      cofounderOpen: true,
    });
    assert.ok(badges.includes("verified_utility"));
    assert.ok(badges.includes("first_25_scout"));
    assert.ok(badges.includes("bug_hunter"));

    const ledger = new ScoringLedger();
    const firstRebuild = ledger.rebuildFromEvents();
    assert.ok(firstRebuild.postsUpdated >= 30);
    assert.ok(firstRebuild.usersUpdated >= 20);
  });
});
