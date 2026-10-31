import { NextResponse, type NextRequest } from "next/server";
import { createHackathonSpace, fetchHackathons } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const hackathons = await fetchHackathons();
    return NextResponse.json({ hackathons });
  } catch (err) {
    console.error("[api/hackathons] GET failed:", err);
    return NextResponse.json({ error: "failed_to_fetch_hackathons" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Hackathon Name is required." },
        { status: 400 }
      );
    }

    const hackathon = await createHackathonSpace({
      name: body.name.trim(),
      slug: body.slug?.trim() || undefined,
      tag: body.tag?.trim() || undefined,
      description: body.description?.trim() || undefined,
      organizerName: body.organizerName?.trim() || "Community Organizer",
      websiteUrl: body.websiteUrl?.trim() || undefined,
      bannerUrl: body.bannerUrl?.trim() || undefined,
    });

    const origin = req.nextUrl.origin || "https://arrakis.dev";
    const inviteUrl = `${origin}/create?hackathon=${encodeURIComponent(hackathon.slug)}`;

    return NextResponse.json(
      {
        hackathon,
        inviteUrl,
        submitPath: `/create?hackathon=${encodeURIComponent(hackathon.slug)}`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/hackathons] POST failed:", err);
    return NextResponse.json({ error: "failed_to_create_hackathon" }, { status: 500 });
  }
}
