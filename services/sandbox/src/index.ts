import { createServer } from "node:http";
import { createMockTrialRun, getMockTrialStreamEvents } from "@arrakis/contracts";

const PORT = Number(process.env.SANDBOX_PORT ?? 4002);
const DRIVER = process.env.SANDBOX_DRIVER ?? "mock";

const server = createServer((req, res) => {
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
    res.end(JSON.stringify({ status: "ok", service: "sandbox", driver: DRIVER }));
    return;
  }

  // POST /try/:postId
  const tryMatch = url.pathname.match(/^\/try\/([^/]+)$/);
  if (req.method === "POST" && tryMatch) {
    const postId = decodeURIComponent(tryMatch[1]!);
    const run = createMockTrialRun("usr_ritam", postId, `http://localhost:${PORT}`);
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify(run));
    return;
  }

  // GET /try/:runId/stream (SSE)
  const streamMatch = url.pathname.match(/^\/try\/([^/]+)\/stream$/);
  if (req.method === "GET" && streamMatch) {
    const runId = decodeURIComponent(streamMatch[1]!);
    const postId = url.searchParams.get("postId") ?? "post_resume_json";
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    const events = getMockTrialStreamEvents(runId, postId);
    events.forEach((evt, i) => {
      setTimeout(() => {
        if (!res.writableEnded) {
          res.write(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`);
          if (i === events.length - 1) {
            res.end();
          }
        }
      }, i * 180);
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`[arrakis:sandbox] Listening on http://localhost:${PORT} (driver=${DRIVER})`);
  });
}
