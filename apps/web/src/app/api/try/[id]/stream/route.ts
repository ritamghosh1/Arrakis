import type { NextRequest } from "next/server";
import { getMockTrialStreamEvents } from "@arrakis/contracts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id: runId } = await ctx.params;
  const postId = req.nextUrl.searchParams.get("postId") ?? "post_resume_json";

  const sandboxUrl = process.env.NEXT_PUBLIC_SANDBOX_URL;
  if (sandboxUrl) {
    try {
      const upstream = await fetch(
        `${sandboxUrl}/try/${encodeURIComponent(runId)}/stream?postId=${encodeURIComponent(postId)}`,
      );
      if (upstream.ok && upstream.body) {
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      }
    } catch {
      // Fallback to built-in SSE stream
    }
  }

  const events = getMockTrialStreamEvents(runId, postId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for (const evt of events) {
        controller.enqueue(encoder.encode(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`));
        await new Promise((r) => setTimeout(r, 160));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
