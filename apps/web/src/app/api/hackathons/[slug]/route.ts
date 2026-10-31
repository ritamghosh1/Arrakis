import { NextResponse, type NextRequest } from "next/server";
import { fetchHackathonBySlug, fetchHackathonProjects } from "@/lib/data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function GET(req: NextRequest, { params }: Props) {
  try {
    const { slug } = await params;
    const hackathon = await fetchHackathonBySlug(slug);
    if (!hackathon) {
      return NextResponse.json({ error: "hackathon_not_found" }, { status: 404 });
    }

    const projects = await fetchHackathonProjects(hackathon.id);
    return NextResponse.json({
      hackathon,
      projects,
      projectCount: projects.length,
    });
  } catch (err) {
    console.error("[api/hackathons/[slug]] GET failed:", err);
    return NextResponse.json({ error: "failed_to_fetch_hackathon" }, { status: 500 });
  }
}
