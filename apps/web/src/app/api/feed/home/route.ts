import { NextResponse, type NextRequest } from "next/server";
import { fetchHomeFeed } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("mode") === "following" ? "following" : "for_you";
  const userId = sp.get("userId") ?? process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? "usr_ritam";
  try {
    const feed = await fetchHomeFeed(userId, mode, sp.get("cursor"));
    return NextResponse.json(feed);
  } catch {
    return NextResponse.json({ error: "feed_unavailable" }, { status: 502 });
  }
}
