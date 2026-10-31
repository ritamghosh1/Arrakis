import { NextResponse, type NextRequest } from "next/server";
import type { QuickFeedbackTag, SandboxProjectType, TelemetryPayload } from "@arrakis/contracts";
import { recordTelemetry } from "@/lib/data";

export const dynamic = "force-dynamic";

function isValidFeedbackTag(v: unknown): v is QuickFeedbackTag {
  return v === "WORKS_GREAT" || v === "BUGGY" || v === null;
}

function isValidProjectType(v: unknown): v is SandboxProjectType {
  return v === "BROWSER" || v === "CONTAINER";
}

export async function POST(req: NextRequest) {
  let body: Partial<TelemetryPayload>;
  try {
    body = (await req.json()) as Partial<TelemetryPayload>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const project_id = typeof body.project_id === "string" ? body.project_id.trim() : "";
  const user_id =
    typeof body.user_id === "string" && body.user_id.trim()
      ? body.user_id.trim()
      : "usr_ritam";

  if (!project_id) {
    return NextResponse.json({ error: "missing_project_id" }, { status: 400 });
  }

  const payload: TelemetryPayload = {
    project_id,
    user_id,
    project_type: isValidProjectType(body.project_type) ? body.project_type : "CONTAINER",
    health_ok: Boolean(body.health_ok ?? true),
    boot_time_ms: Math.max(0, Number(body.boot_time_ms ?? 0) || 0),
    switched_to_landscape: Boolean(body.switched_to_landscape ?? false),
    active_dwell_seconds: Math.max(0, Number(body.active_dwell_seconds ?? 0) || 0),
    interaction_bursts: Math.max(0, Number(body.interaction_bursts ?? 0) || 0),
    quick_feedback_tag: isValidFeedbackTag(body.quick_feedback_tag)
      ? body.quick_feedback_tag
      : null,
  };

  let result;
  try {
    result = await recordTelemetry(payload);
  } catch (err) {
    console.error("[telemetry] persist failed", err);
    return NextResponse.json({ error: "telemetry_persist_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    run_tier: result.run_tier,
    tag_delta: result.tag_delta,
    popularity_score: result.updated_post?.popularityScore ?? null,
    usability_score: result.updated_post?.usabilityScore ?? null,
    daily_leaderboard_score: result.updated_post?.dailyLeaderboardScore ?? null,
  });
}
