import { NextResponse, type NextRequest } from "next/server";
import { toggleFollow } from "@/lib/data";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ userId: string }> };

async function forward(method: "POST" | "DELETE", userId: string, followerId: string) {
  const result = await toggleFollow(followerId, userId, method === "POST");
  const recommenderUrl = process.env.NEXT_PUBLIC_RECOMMENDER_URL;
  if (recommenderUrl) {
    try {
      await fetch(
        `${recommenderUrl}/follow/${encodeURIComponent(userId)}?followerId=${encodeURIComponent(followerId)}`,
        { method },
      );
    } catch {
      // Background sync best effort
    }
  }
  return NextResponse.json(result);
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
