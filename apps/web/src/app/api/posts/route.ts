import { NextResponse, type NextRequest } from "next/server";
import {
  computeContentHash,
  computeSimHash64,
  type UploadPostInput,
} from "@arrakis/contracts";
import { createRuntimePost, deleteRuntimePost } from "@/lib/data";
import { USE_DB, dbDeletePost, dbInsertPost } from "@/lib/db";

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
      hackathonId: body.hackathonId,
      hackathonName: body.hackathonName,
    });

    let deduplicated = false;
    let matchedPostId: string | undefined;
    let contentHash = computeContentHash(created);
    let simHash = computeSimHash64(created).toString(16).padStart(16, "0");

    if (USE_DB) {
      try {
        const dbRes = await dbInsertPost(created);
        deduplicated = dbRes.deduplicated;
        matchedPostId = dbRes.matchedPostId;
        contentHash = dbRes.contentHash;
        simHash = dbRes.simHash;
      } catch {
        // Fallback to in-memory runtime store if Postgres is offline
      }
    }

    return NextResponse.json(
      {
        ...created,
        post: created,
        deduplicated,
        deduplication: {
          status: deduplicated ? "merged_existing" : "unique_new",
          matchedPostId,
          contentHash,
          simHash,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "invalid_post_payload" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");
    let authorId = searchParams.get("authorId") || undefined;

    if (!id) {
      try {
        const body = (await req.json()) as { id?: string; authorId?: string };
        id = body.id ?? null;
        if (body.authorId) authorId = body.authorId;
      } catch {
        // Query param only
      }
    }

    if (!id) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    const inMemoryDeleted = deleteRuntimePost(id);
    let dbDeleted = false;

    if (USE_DB) {
      try {
        dbDeleted = await dbDeletePost(id, authorId);
      } catch (err) {
        console.error("Failed to delete post from db:", err);
      }
    }

    return NextResponse.json({
      ok: true,
      id,
      deleted: inMemoryDeleted || dbDeleted,
      inMemoryDeleted,
      dbDeleted,
    });
  } catch (err) {
    return NextResponse.json({ error: "failed_to_delete_post" }, { status: 500 });
  }
}
