import { NextResponse, type NextRequest } from "next/server";
import type { PreflightResponse } from "@arrakis/contracts";

export const dynamic = "force-dynamic";

function isPrivateOrBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  // Check IPv4 private / loopback / link-local metadata ranges
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, aStr, bStr] = ipv4Match;
    const a = Number(aStr);
    const b = Number(bStr);
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    ) {
      return true;
    }
  }
  return false;
}

function checkCanIframe(headers: Headers): boolean {
  const xfo = (headers.get("x-frame-options") ?? "").toUpperCase();
  if (xfo.includes("DENY") || xfo.includes("SAMEORIGIN")) {
    return false;
  }

  const csp = headers.get("content-security-policy") ?? "";
  const match = csp.match(/frame-ancestors\s+([^;]+)/i);
  if (match && match[1]) {
    const policy = match[1].trim().toLowerCase();
    if (policy.includes("'none'") || (policy.includes("'self'") && !policy.includes("*"))) {
      return false;
    }
  }
  return true;
}

export async function POST(req: NextRequest) {
  let targetUrl = "";
  try {
    const body = (await req.json()) as { target_url?: string };
    targetUrl = (body.target_url ?? "").trim();
  } catch {
    return NextResponse.json(
      { health_ok: false, can_iframe: false, latency_ms: 0 } satisfies PreflightResponse,
      { status: 400 }
    );
  }

  if (!targetUrl) {
    return NextResponse.json(
      { health_ok: false, can_iframe: false, latency_ms: 0 } satisfies PreflightResponse,
      { status: 400 }
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return NextResponse.json(
      { health_ok: false, can_iframe: false, latency_ms: 0 } satisfies PreflightResponse,
      { status: 400 }
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json(
      { health_ok: false, can_iframe: false, latency_ms: 0 } satisfies PreflightResponse,
      { status: 400 }
    );
  }

  // SSRF Guard: block private / loopback / metadata hosts
  if (isPrivateOrBlockedHost(parsed.hostname)) {
    return NextResponse.json(
      { health_ok: false, can_iframe: false, latency_ms: 0 } satisfies PreflightResponse,
      { status: 403 }
    );
  }

  // Offline/seed fallback for demo.arrakis.dev domains so hackathon demo works offline
  if (parsed.hostname === "demo.arrakis.dev" || parsed.hostname.endsWith(".arrakis.dev")) {
    return NextResponse.json({
      health_ok: true,
      can_iframe: true,
      latency_ms: 118,
    } satisfies PreflightResponse);
  }

  const start = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    let res = await fetch(parsed.toString(), {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
    });

    if (res.status === 405) {
      res = await fetch(parsed.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
      });
    }

    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    const healthOk = res.status < 500;
    const canIframe = checkCanIframe(res.headers);

    return NextResponse.json({
      health_ok: healthOk,
      can_iframe: canIframe,
      latency_ms: latencyMs,
    } satisfies PreflightResponse);
  } catch {
    const latencyMs = Math.max(1, Math.round(performance.now() - start));
    return NextResponse.json({
      health_ok: false,
      can_iframe: false,
      latency_ms: latencyMs,
    } satisfies PreflightResponse);
  } finally {
    clearTimeout(timeout);
  }
}
