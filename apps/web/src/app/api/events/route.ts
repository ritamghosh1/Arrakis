import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Telemetry sink. In mock mode events are accepted and dropped; otherwise forwarded to Dev B's recommender. */
export async function POST(req: NextRequest) {
  let body: { events?: unknown[] } = {};
  try {
    body = (await req.json()) as { events?: unknown[] };
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const events = Array.isArray(body.events) ? body.events : [];
  if (process.env.MOCK === "0") {
    const url = process.env.NEXT_PUBLIC_RECOMMENDER_URL ?? "http://localhost:4001";
    void fetch(`${url}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    }).catch(() => undefined);
  }
  return NextResponse.json({ accepted: events.length }, { status: 202 });
}
