import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import {
  type LeaderboardPeriod,
  type LeaderboardType,
  type TelemetryEvent,
  getMockProfile,
} from "@arrakis/contracts";
import {
  ScoringLedger,
  computeBuilderScore,
  computeProofOfTrialScore,
  computeScoutLevel,
  computeScoutXpForAction,
  defaultScoringLedger,
  evaluateUserBadges,
  isEligibleForVerifiedUtility,
} from "./engine.ts";

export {
  ScoringLedger,
  computeBuilderScore,
  computeProofOfTrialScore,
  computeScoutLevel,
  computeScoutXpForAction,
  defaultScoringLedger,
  evaluateUserBadges,
  isEligibleForVerifiedUtility,
};

const PORT = Number(process.env.SCORING_PORT ?? 4003);

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
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
    const typeParam = url.searchParams.get("type") ?? "builders";
    const type: LeaderboardType =
      typeParam === "testers" ||
      typeParam === "trending" ||
      typeParam === "useful" ||
      typeParam === "popular"
        ? typeParam
        : "builders";
    const period = (url.searchParams.get("period") ?? "7d") as LeaderboardPeriod;
    const viewerId = url.searchParams.get("userId") ?? "usr_ritam";
    const data = defaultScoringLedger.getLeaderboard(type, period, viewerId);
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

  if (req.method === "POST" && url.pathname === "/events") {
    const body = await readJsonBody(req);
    const events = Array.isArray(body.events) ? (body.events as TelemetryEvent[]) : [];
    const result = defaultScoringLedger.ingestEvents(events);
    res.writeHead(202, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    return;
  }

  if (req.method === "POST" && url.pathname === "/try-complete") {
    const body = await readJsonBody(req);
    const result = defaultScoringLedger.recordCompletedTrial({
      eventId: typeof body.eventId === "string" ? body.eventId : undefined,
      runId: String(body.runId ?? `run_${Date.now()}`),
      userId: String(body.userId ?? "usr_ritam"),
      postId: String(body.postId ?? ""),
      durationMs: Number(body.durationMs ?? 3200),
    });
    res.writeHead(result.accepted ? 200 : 400, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    return;
  }

  if (req.method === "POST" && url.pathname === "/upvote") {
    const body = await readJsonBody(req);
    const result = defaultScoringLedger.castUpvote({
      eventId: typeof body.eventId === "string" ? body.eventId : undefined,
      userId: String(body.userId ?? "usr_ritam"),
      postId: String(body.postId ?? ""),
      ipCluster: typeof body.ipCluster === "string" ? body.ipCluster : undefined,
    });
    res.writeHead(result.accepted ? 200 : 400, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    return;
  }

  if (req.method === "POST" && url.pathname === "/reviews") {
    const body = await readJsonBody(req);
    const result = defaultScoringLedger.submitReview({
      runId: String(body.runId ?? ""),
      userId: String(body.userId ?? "usr_ritam"),
      postId: String(body.postId ?? ""),
      worked: Boolean(body.worked ?? true),
      wouldUse: Boolean(body.wouldUse ?? true),
      bug: typeof body.bug === "string" ? body.bug : undefined,
    });
    res.writeHead(result.accepted ? 201 : 400, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    return;
  }

  if (req.method === "POST" && url.pathname === "/rebuild") {
    const result = defaultScoringLedger.rebuildFromEvents();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, () => {
    console.log(`[arrakis:scoring] Listening on http://localhost:${PORT}`);
  });
}
