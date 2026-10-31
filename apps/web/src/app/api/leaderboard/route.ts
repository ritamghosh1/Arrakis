import { NextResponse, type NextRequest } from "next/server";
import type { LeaderboardPeriod, LeaderboardType } from "@arrakis/contracts";
import { fetchLeaderboard } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const typeParam = sp.get("type");
  const periodParam = sp.get("period");
  const type: LeaderboardType =
    typeParam === "testers" ||
    typeParam === "trending" ||
    typeParam === "useful" ||
    typeParam === "popular"
      ? typeParam
      : "builders";
  const period: LeaderboardPeriod =
    periodParam === "24h" || periodParam === "all" ? periodParam : "7d";
  const viewerId = sp.get("userId") ?? process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? "usr_ritam";

  const data = await fetchLeaderboard(type, period, viewerId);
  return NextResponse.json(data);
}
