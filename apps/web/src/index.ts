import {
  type FeedResponse,
  type LeaderboardResponse,
  getMockGlobalFeed,
  getMockHomeFeed,
  getMockLeaderboard,
} from "@arrakis/contracts";

/**
 * M0 Shared Contract Verification for apps/web (Dev A: Ritam)
 * Ready for M1 Next.js App Router + DESIGN.md UI implementation.
 */
export function getInitialDemoState(): {
  homeFeed: FeedResponse;
  globalFeed: FeedResponse;
  leaderboard: LeaderboardResponse;
} {
  return {
    homeFeed: getMockHomeFeed("usr_ritam", "for_you"),
    globalFeed: getMockGlobalFeed(),
    leaderboard: getMockLeaderboard("builders", "7d", "usr_ritam"),
  };
}
