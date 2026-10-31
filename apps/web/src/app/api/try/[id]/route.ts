import { NextResponse, type NextRequest } from "next/server";
import { createMockTrialRun } from "@arrakis/contracts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id: postId } = await ctx.params;
  const sandboxUrl = process.env.NEXT_PUBLIC_SANDBOX_URL;
  if (sandboxUrl) {
    try {
      const res = await fetch(`${sandboxUrl}/try/${encodeURIComponent(postId)}`, { method: "POST" });
      if (res.ok) return NextResponse.json(await res.json(), { status: res.status });
    } catch {
      // Fallback to built-in trial runner
    }
  }
  const run = createMockTrialRun("usr_ritam", postId, "");
  run.streamUrl = `/api/try/${encodeURIComponent(run.id)}/stream?postId=${encodeURIComponent(run.postId)}`;
  return NextResponse.json(run, { status: 201 });
}
