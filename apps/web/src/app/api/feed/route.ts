import { NextResponse, type NextRequest } from "next/server";
import { fetchGlobalFeed, fetchHomeFeed, intentVectorFor, rankedFeedProjects } from "@/lib/data";
import type { DemoMode } from "@arrakis/contracts";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const userId = sp.get("userId") ?? process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? "usr_ritam";
  const limit = Math.min(25, Math.max(1, Number(sp.get("limit") ?? 10) || 10));
  const rawMode = sp.get("mode");
  const q = sp.get("q") ?? undefined;

  try {
    if (rawMode === "global" || q !== undefined) {
      const demoMode = (sp.get("demoMode") as DemoMode | null) ?? undefined;
      const category = sp.get("category") ?? undefined;
      const verifiedOnly = sp.get("verified") === "1";
      const globalFeed = await fetchGlobalFeed({ q, mode: demoMode, category, verifiedOnly });
      return NextResponse.json({
        ...globalFeed,
        projects: globalFeed.items.map((i) => i.post),
      });
    }

    const mode = rawMode === "following" ? "following" : "for_you";
    const projects = mode === "following" ? [] : await rankedFeedProjects(userId, limit);
    const feed = await fetchHomeFeed(userId, mode, sp.get("cursor"));
    return NextResponse.json({
      ...feed,
      projects: projects.length > 0 ? projects : feed.items.map((i) => i.post),
      user_vector: await intentVectorFor(userId),
    });
  } catch (err) {
    console.error("[feed] failed", err);
    return NextResponse.json({ error: "feed_unavailable" }, { status: 502 });
  }
}
