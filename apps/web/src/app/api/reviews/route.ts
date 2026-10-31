import { NextResponse, type NextRequest } from "next/server";
import { createRuntimeReview } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      runId?: string;
      userId?: string;
      postId?: string;
      worked?: boolean;
      wouldUse?: boolean;
      bug?: string;
    };
    if (!body.postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }
    const review = createRuntimeReview({
      runId: body.runId ?? `run_${Date.now().toString(36)}`,
      userId: body.userId ?? process.env.NEXT_PUBLIC_DEFAULT_USER_ID ?? "usr_ritam",
      postId: body.postId,
      worked: Boolean(body.worked),
      wouldUse: Boolean(body.wouldUse),
      bug: body.bug,
    });
    return NextResponse.json(review, { status: 201 });
  } catch {
    return NextResponse.json({ error: "invalid_review_payload" }, { status: 400 });
  }
}
