import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import {
  type LeaderboardPeriod,
  type LeaderboardType,
  getMockLeaderboard,
  getMockProfile,
} from "@arrakis/contracts";

const PORT = Number(process.env.SCORING_PORT ?? 4003);

/**
 * Proof-of-Trial (Anti-Clout) Formula — Pillar 4 (Dev A: Ritam)
 * Upvotes from users with a completed TrialRun count 3x vs passive viewers (1x).
 */
export function computeProofOfTrialScore(params: {
  passiveUpvotes: number;
  trialUpvotes: number;
  uniqueViewers: number;
  uniqueTesters: number;
  workedRate: number;
  uptimePct: number;
  crashRate: number;
  ageHours: number;
}): number {
  const weightedVotes = params.trialUpvotes * 3 + params.passiveUpvotes;
  const trialRate = params.uniqueTesters / Math.max(params.uniqueViewers, 1);
  const uptimeScore = params.uptimePct >= 85 ? 1.0 : params.uptimePct / 100;
  const quality =
    0.5 * params.workedRate + 0.3 * uptimeScore + 0.2 * Math.max(0, 1 - params.crashRate);
  const halfLifeHours = 7 * 24;
  const decay = Math.pow(0.5, params.ageHours / halfLifeHours);

  return Number(
    (Math.log(1 + weightedVotes) * (0.5 + quality) * (1 + 0.3 * trialRate) * decay * 10).toFixed(2)
  );
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "scoring" }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/leaderboard") {
    const type = (url.searchParams.get("type") ?? "builders") as LeaderboardType;
    const period = (url.searchParams.get("period") ?? "7d") as LeaderboardPeriod;
    const viewerId = url.searchParams.get("userId") ?? "usr_ritam";
    const data = getMockLeaderboard(type, period, viewerId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
    return;
  }

  const profileMatch = url.pathname.match(/^\/users\/([^/]+)\/profile$/);
  if (req.method === "GET" && profileMatch) {
    const handleOrId = decodeURIComponent(profileMatch[1]!);
    const viewerId = url.searchParams.get("viewerId") ?? "usr_ritam";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(getMockProfile(handleOrId, viewerId)));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`[arrakis:scoring] Listening on http://localhost:${PORT}`);
  });
}
