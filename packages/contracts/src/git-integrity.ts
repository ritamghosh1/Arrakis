/**
 * Git Tree, Commit History & Plagiarism / Duplicate Detector Simulation
 *
 * Simulates:
 * 1. Asking for and checking a project's .git repository or bundle
 * 2. Calculating Git-like 40-character SHAs for each file and commit tree
 * 3. Comparing hashes against stored hashes in the database/mock registry
 * 4. Flagging duplicate projects with matching Git hashes or repository URLs
 */

import type { GitFileHash, GitInspectionResult, StoredGitHashRecord } from "./types.ts";

/**
 * Pure TypeScript SHA-1 implementation (RFC 3174)
 * Produces authentic 40-char Git object hashes in both browser and Node environments
 * without external dependencies.
 */
export function sha1Hex(message: string): string {
  // Convert UTF-8 string to bytes
  const utf8 = unescape(encodeURIComponent(message));
  const bytes: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    bytes.push(utf8.charCodeAt(i));
  }

  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) {
    bytes.push(0);
  }

  // Append 64-bit big-endian length
  const hi = Math.floor(bitLength / 0x100000000);
  const lo = bitLength >>> 0;
  bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
  bytes.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Uint32Array(80);

  for (let i = 0; i < bytes.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      const b0 = bytes[i + t * 4] ?? 0;
      const b1 = bytes[i + t * 4 + 1] ?? 0;
      const b2 = bytes[i + t * 4 + 2] ?? 0;
      const b3 = bytes[i + t * 4 + 3] ?? 0;
      w[t] = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3;
    }
    for (let t = 16; t < 80; t++) {
      const v = (w[t - 3] ?? 0) ^ (w[t - 8] ?? 0) ^ (w[t - 14] ?? 0) ^ (w[t - 16] ?? 0);
      w[t] = (v << 1) | (v >>> 31);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let t = 0; t < 80; t++) {
      let f: number;
      let k: number;
      if (t < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const wt = w[t] ?? 0;
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + wt) | 0;
      e = d;
      d = c;
      c = ((b << 30) | (b >>> 2)) | 0;
      b = a;
      a = temp;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return `${hex(h0)}${hex(h1)}${hex(h2)}${hex(h3)}${hex(h4)}`.toLowerCase();
}

/**
 * Normalizes a repository URL for canonical duplicate detection.
 * Strips http/https protocols, www, trailing .git, and trailing slashes.
 */
export function normalizeGitUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  return rawUrl
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\.git\/?$/i, "")
    .replace(/\/+$/g, "");
}

/**
 * Calculates a Git-like object SHA for a given blob type and payload.
 * Simulates standard `git hash-object -t <type>`
 */
export function computeGitObjectSha(type: "blob" | "commit" | "tree", content: string): string {
  const header = `${type} ${content.length}\0`;
  return sha1Hex(header + content);
}

/**
 * Simulates checking the .git repository/file structure and calculating
 * git-like SHA-1 for each file in the commit history.
 */
export function simulateGitInspection(
  repoUrl: string,
  options?: {
    gitFileName?: string;
    branch?: string;
  }
): {
  normalizedUrl: string;
  branch: string;
  commitSha: string;
  treeSha: string;
  parentSha: string;
  files: GitFileHash[];
} {
  const normalized = normalizeGitUrl(repoUrl) || "github.com/arrakis/unknown-project";
  const branch = options?.branch || "main";

  // Derive deterministic file SHAs from the repository URL + file paths
  const baseSha = sha1Hex(`git:repo:${normalized}`);
  const treeSha = sha1Hex(`tree ${normalized}:${baseSha}`);
  const parentSha = sha1Hex(`commit-parent:${normalized}:${baseSha.slice(0, 10)}`);
  const commitSha = sha1Hex(
    `commit ${treeSha}\ntree ${treeSha}\nparent ${parentSha}\nauthor Dev <dev@arrakis.dev>\n\nfeat: build utility (${normalized})`
  );

  const sampleFiles: Array<{ path: string; template: string; msg: string }> = [
    {
      path: "src/index.ts",
      template: `// Main entrypoint for ${normalized}\nexport async function run() {\n  console.log("Starting service: ${normalized}");\n}`,
      msg: "feat: implement primary worker runtime",
    },
    {
      path: "package.json",
      template: `{\n  "name": "${normalized.split("/").pop() || "arrakis-tool"}",\n  "version": "1.0.0",\n  "private": true\n}`,
      msg: "chore: project manifest and deps",
    },
    {
      path: "README.md",
      template: `# Project: ${normalized}\n\nBuilt for Arrakis Hackathon.\nInstant Try-It container demo ready.`,
      msg: "docs: add usage notes & try-it instructions",
    },
    {
      path: "Dockerfile",
      template: `FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD ["npm", "start"]`,
      msg: "infra: container sandbox configuration",
    },
    {
      path: ".git/config",
      template: `[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n[remote "origin"]\n\turl = ${repoUrl}\n\tfetch = +refs/heads/*:refs/remotes/origin/*`,
      msg: "git: upstream origin tracking",
    },
    {
      path: ".git/HEAD",
      template: `ref: refs/heads/${branch}\n`,
      msg: "git: head pointer",
    },
  ];

  if (options?.gitFileName) {
    sampleFiles.unshift({
      path: options.gitFileName,
      template: `// Uploaded git archive or bundle metadata\nsource: ${options.gitFileName}\nhash: ${baseSha}`,
      msg: "inspect: uploaded .git archive bundle",
    });
  }

  const files: GitFileHash[] = sampleFiles.map((f) => {
    const blobContent = `${f.template}\n// git-hash-seed:${baseSha.slice(0, 8)}`;
    return {
      path: f.path,
      sizeBytes: blobContent.length,
      blobSha: computeGitObjectSha("blob", blobContent),
      commitMessage: f.msg,
    };
  });

  return {
    normalizedUrl: normalized,
    branch,
    commitSha,
    treeSha,
    parentSha,
    files,
  };
}

/**
 * Seed repository records pre-loaded into mock storage
 */
const INITIAL_STORED_GIT_RECORDS: StoredGitHashRecord[] = [
  {
    urlHash: sha1Hex("github.com/ritamghosh1/arrakis"),
    commitSha: sha1Hex("commit-seed:github.com/ritamghosh1/arrakis"),
    treeSha: sha1Hex("tree-seed:github.com/ritamghosh1/arrakis"),
    repoUrl: "https://github.com/ritamghosh1/Arrakis",
    normalizedUrl: "github.com/ritamghosh1/arrakis",
    projectId: "post_flagship_arrakis",
    projectTitle: "Arrakis Flagship Project",
    authorHandle: "ritam",
    registeredAt: "2026-10-30T10:00:00Z",
  },
  {
    urlHash: sha1Hex("github.com/iamsrinjoy/random_stuff"),
    commitSha: sha1Hex("commit-seed:github.com/iamsrinjoy/random_stuff"),
    treeSha: sha1Hex("tree-seed:github.com/iamsrinjoy/random_stuff"),
    repoUrl: "https://github.com/iamsrinjoy/random_stuff",
    normalizedUrl: "github.com/iamsrinjoy/random_stuff",
    projectId: "post_srinjoy_stuff",
    projectTitle: "Recommendation & Sandbox Core",
    authorHandle: "srinjoy",
    registeredAt: "2026-10-30T11:00:00Z",
  },
  {
    urlHash: sha1Hex("github.com/alexchen/resume2schema"),
    commitSha: sha1Hex("commit-seed:github.com/alexchen/resume2schema"),
    treeSha: sha1Hex("tree-seed:github.com/alexchen/resume2schema"),
    repoUrl: "https://github.com/alexchen/resume2schema",
    normalizedUrl: "github.com/alexchen/resume2schema",
    projectId: "post_flagship_1",
    projectTitle: "Resume2Schema — JSON Resume Parser",
    authorHandle: "alexchen",
    registeredAt: "2026-10-30T12:00:00Z",
  },
  {
    urlHash: sha1Hex("github.com/sarahdev/csv-surgeon"),
    commitSha: sha1Hex("commit-seed:github.com/sarahdev/csv-surgeon"),
    treeSha: sha1Hex("tree-seed:github.com/sarahdev/csv-surgeon"),
    repoUrl: "https://github.com/sarahdev/csv-surgeon",
    normalizedUrl: "github.com/sarahdev/csv-surgeon",
    projectId: "post_flagship_2",
    projectTitle: "CSV Surgeon — Dirty Spreadsheet Fixer",
    authorHandle: "sarahdev",
    registeredAt: "2026-10-30T13:00:00Z",
  },
];

/**
 * In-memory Mock Git Hash Registry
 * Stores hashed GitHub URLs, simulated commit tree SHAs, and project mappings.
 */
class GitIntegrityMockRegistry {
  private records: Map<string, StoredGitHashRecord> = new Map();

  constructor() {
    for (const rec of INITIAL_STORED_GIT_RECORDS) {
      this.records.set(rec.normalizedUrl, rec);
      this.records.set(rec.urlHash, rec);
      this.records.set(rec.commitSha, rec);
    }
  }

  public getAllRecords(): StoredGitHashRecord[] {
    const unique = new Map<string, StoredGitHashRecord>();
    for (const rec of this.records.values()) {
      unique.set(rec.normalizedUrl, rec);
    }
    return Array.from(unique.values());
  }

  public findMatch(normalizedUrl: string, commitSha?: string): StoredGitHashRecord | null {
    if (!normalizedUrl) return null;
    const urlHash = sha1Hex(normalizedUrl);
    if (this.records.has(normalizedUrl)) return this.records.get(normalizedUrl)!;
    if (this.records.has(urlHash)) return this.records.get(urlHash)!;
    if (commitSha && this.records.has(commitSha)) return this.records.get(commitSha)!;
    return null;
  }

  public register(record: StoredGitHashRecord): void {
    this.records.set(record.normalizedUrl, record);
    this.records.set(record.urlHash, record);
    this.records.set(record.commitSha, record);
  }
}

// Global singleton instance for runtime memory
export const gitIntegrityRegistry = new GitIntegrityMockRegistry();

/**
 * Main verification function:
 * Simulates asking for & checking .git file/repo, calculates Git-like SHAs,
 * compares with stored database/mock hashes, and flags if duplicate found.
 */
export function verifyGitIntegrity(
  repoUrl: string,
  options?: {
    gitFileName?: string;
    projectMeta?: {
      id?: string;
      title?: string;
      authorHandle?: string;
    };
    registerIfClean?: boolean;
  }
): GitInspectionResult {
  const normalized = normalizeGitUrl(repoUrl);
  if (!normalized) {
    return {
      repoUrl: "",
      normalizedUrl: "",
      branch: "main",
      commitSha: "",
      treeSha: "",
      files: [],
      isDuplicate: false,
      isFlagged: false,
      flagReason: "No repository URL provided.",
    };
  }

  const inspection = simulateGitInspection(repoUrl, {
    gitFileName: options?.gitFileName,
  });

  const urlHash = sha1Hex(normalized);
  const matched = gitIntegrityRegistry.findMatch(normalized, inspection.commitSha);

  // If a match is found and it is NOT the same project ID being updated -> FLAG IT!
  const isDuplicate =
    Boolean(matched) &&
    (!options?.projectMeta?.id || matched?.projectId !== options.projectMeta.id);

  if (isDuplicate && matched) {
    return {
      repoUrl,
      normalizedUrl: normalized,
      branch: inspection.branch,
      commitSha: inspection.commitSha,
      treeSha: inspection.treeSha,
      parentSha: inspection.parentSha,
      files: inspection.files,
      isDuplicate: true,
      isFlagged: true,
      flagReason: `Git SHA fingerprint matched existing project "${matched.projectTitle}" by @${matched.authorHandle}.`,
      matchedProject: {
        id: matched.projectId,
        title: matched.projectTitle,
        authorHandle: matched.authorHandle,
        registeredAt: matched.registeredAt,
        repoUrl: matched.repoUrl,
      },
    };
  }

  // If clean and registration requested, store it in the registry
  if (options?.registerIfClean) {
    gitIntegrityRegistry.register({
      urlHash,
      commitSha: inspection.commitSha,
      treeSha: inspection.treeSha,
      repoUrl,
      normalizedUrl: normalized,
      projectId: options.projectMeta?.id || `proj_${Date.now()}`,
      projectTitle: options.projectMeta?.title || "New Project",
      authorHandle: options.projectMeta?.authorHandle || "developer",
      registeredAt: new Date().toISOString(),
    });
  }

  return {
    repoUrl,
    normalizedUrl: normalized,
    branch: inspection.branch,
    commitSha: inspection.commitSha,
    treeSha: inspection.treeSha,
    parentSha: inspection.parentSha,
    files: inspection.files,
    isDuplicate: false,
    isFlagged: false,
    flagReason: undefined,
  };
}
