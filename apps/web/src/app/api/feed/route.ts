import { NextResponse, type NextRequest } from "next/server";
import { fetchHomeFeed, intentVectorFor, rankedFeedProjects } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const userId = sp.get("userId") ?? process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? "usr_ritam";
  const limit = Math.min(25, Math.max(1, Number(sp.get("limit") ?? 10) || 10));
  const mode = sp.get("mode") === "following" ? "following" : "for_you";

  try {
    const projects = await rankedFeedProjects(userId, limit);
    const feed = await fetchHomeFeed(userId, mode, sp.get("cursor"));
    return NextResponse.json({
      ...feed,
      projects,
      user_vector: await intentVectorFor(userId),
    });
  } catch (err) {
    console.error("[feed] failed", err);
    return NextResponse.json({ error: "feed_unavailable" }, { status: 502 });
  }
}
