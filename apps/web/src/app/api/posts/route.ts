import { NextResponse, type NextRequest } from "next/server";
import type { UploadPostInput } from "@arrakis/contracts";
import { createRuntimePost } from "@/lib/data";
import { USE_DB, dbInsertPost } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<UploadPostInput>;
    if (!body.title?.trim() || !body.problemStatement?.trim() || !body.demo?.target?.trim()) {
      return NextResponse.json(
        { error: "Title, Problem Statement, and Demo Target are required." },
        { status: 400 }
      );
    }
    const created = createRuntimePost({
      authorId: body.authorId ?? process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? "usr_ritam",
      title: body.title,
      problemStatement: body.problemStatement,
      category: body.category ?? "Developer Tools",
      videoUrl:
        body.videoUrl ??
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4#t=2",
      thumbUrl: body.thumbUrl,
      durationSec: body.durationSec ?? 60,
      demo: body.demo,
      tags: Array.isArray(body.tags) ? body.tags : ["utility", "indie"],
    });

    if (USE_DB) {
      try {
        await dbInsertPost(created);
      } catch {
        // Fallback to in-memory runtime store if Postgres is offline
      }
    }

    return NextResponse.json({ ...created, post: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "invalid_post_payload" }, { status: 400 });
  }
}
