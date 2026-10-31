import { NextResponse, type NextRequest } from "next/server";
import { recordFollowState } from "@/lib/data";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ userId: string }> };

async function forward(method: "POST" | "DELETE", userId: string, followerId: string) {
  recordFollowState(followerId, userId, method === "POST");
  if (process.env.MOCK !== "0") {
    return NextResponse.json({ ok: true, followerId, followeeId: userId, following: method === "POST" });
  }
  const url = process.env.NEXT_PUBLIC_RECOMMENDER_URL ?? "http://localhost:4001";
  const res = await fetch(`${url}/follow/${encodeURIComponent(userId)}?followerId=${encodeURIComponent(followerId)}`, {
    method,
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

const viewer = (req: NextRequest) =>
  req.nextUrl.searchParams.get("followerId") ?? process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? "usr_ritam";

export async function POST(req: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params;
  return forward("POST", userId, viewer(req));
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { userId } = await ctx.params;
  return forward("DELETE", userId, viewer(req));
}
