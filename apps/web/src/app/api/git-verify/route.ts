import { NextResponse, type NextRequest } from "next/server";
import {
  gitIntegrityRegistry,
  normalizeGitUrl,
  verifyGitIntegrity,
  type GitInspectionResult,
} from "@arrakis/contracts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const repoUrl: string = typeof body?.repoUrl === "string" ? body.repoUrl.trim() : "";
    const gitFileName: string | undefined =
      typeof body?.gitFileName === "string" ? body.gitFileName.trim() : undefined;
    const register: boolean = body?.register === true;
    const projectMeta = body?.projectMeta as
      | { id?: string; title?: string; authorHandle?: string }
      | undefined;

    if (!repoUrl && !gitFileName) {
      return NextResponse.json(
        { error: "A repository URL or .git bundle file is required for verification." },
        { status: 400 }
      );
    }

    const effectiveUrl = repoUrl || `https://github.com/arrakis-builds/${gitFileName?.replace(/[^a-z0-9]/gi, "-") || "local-project"}`;

    const result: GitInspectionResult = verifyGitIntegrity(effectiveUrl, {
      gitFileName,
      projectMeta,
      registerIfClean: register,
    });

    return NextResponse.json({
      success: true,
      result,
      summary: {
        isFlagged: result.isFlagged,
        commitSha: result.commitSha,
        fileCount: result.files.length,
        normalizedUrl: result.normalizedUrl,
        flagReason: result.flagReason ?? null,
        matchedProject: result.matchedProject ?? null,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error verifying git integrity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const records = gitIntegrityRegistry.getAllRecords();
  return NextResponse.json({
    totalRegistered: records.length,
    records,
  });
}
