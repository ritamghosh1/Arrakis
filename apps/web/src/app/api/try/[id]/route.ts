import { NextResponse, type NextRequest } from "next/server";
import { createMockTrialRun } from "@arrakis/contracts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id: postId } = await ctx.params;
  if (process.env.MOCK !== "0") {
    const run = createMockTrialRun("usr_ritam", postId, "");
    run.streamUrl = `/api/try/${encodeURIComponent(run.id)}/stream?postId=${encodeURIComponent(run.postId)}`;
    return NextResponse.json(run, { status: 201 });
  }
  const url = process.env.NEXT_PUBLIC_SANDBOX_URL ?? "http://localhost:4002";
  const res = await fetch(`${url}/try/${encodeURIComponent(postId)}`, { method: "POST" });
  return NextResponse.json(await res.json(), { status: res.status });
}
