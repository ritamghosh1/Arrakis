import type {
  BadgeId,
  DemoMode,
  FeedItem,
  FeedResponse,
  FormFieldSchema,
  LeaderboardPeriod,
  LeaderboardResponse,
  LeaderboardRow,
  LeaderboardType,
  Post,
  ProfileResponse,
  QuickFeedbackTag,
  Reason,
  Review,
  RunTier,
  SandboxProjectType,
  ScoreBreakdown,
  SseStreamEvent,
  TelemetryEvent,
  TelemetryPayload,
  TrialRun,
  User,
  UserRef,
} from "../types.ts";

/**
 * Deterministic PRNG (Mulberry32) so seed data is 100% identical across machines
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42026);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

function makeUnitVector(seedIdx: number, dominantDim: number): number[] {
  const vec: number[] = [];
  let norm = 0;
  for (let i = 0; i < 16; i++) {
    const base = i === dominantDim % 16 ? 0.85 : ((seedIdx * 13 + i * 7) % 19) / 40 - 0.2;
    vec.push(Number(base.toFixed(4)));
    norm += base * base;
  }
  const mag = Math.sqrt(norm) || 1;
  return vec.map((v) => Number((v / mag).toFixed(4)));
}

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

const CATEGORIES = [
  "Developer Tools",
  "Document & PDF",
  "Data & CSV",
  "Productivity & Automation",
  "Design & Media",
  "Security & Privacy",
] as const;

const SEED_USER_SPECS: Array<{
  id: string;
  handle: string;
  displayName: string;
  role: "builder" | "tester" | "both";
  bio: string;
  verifiedUtility: boolean;
  cofounderOpen: boolean;
  badges: BadgeId[];
  xp: number;
}> = [
  {
    id: "usr_ritam",
    handle: "ritam",
    displayName: "Ritam Ghosh",
    role: "both",
    bio: "Design engineer & indie builder. Testing utility-first tools on Arrakis.",
    verifiedUtility: true,
    cofounderOpen: true,
    badges: ["verified_utility", "first_25_scout", "top_10_builder"],
    xp: 1480,
  },
  {
    id: "usr_srinjoy",
    handle: "srinjoy",
    displayName: "Srinjoy Mukherjee",
    role: "both",
    bio: "Systems & sandbox infrastructure. Building ephemeral micro-VMs and container tooling.",
    verifiedUtility: true,
    cofounderOpen: true,
    badges: ["verified_utility", "top_10_builder", "bug_hunter"],
    xp: 1620,
  },
  {
    id: "usr_aanya",
    handle: "aanya",
    displayName: "Aanya Sharma",
    role: "builder",
    bio: "Shipping document & resume parsers that run in <200ms.",
    verifiedUtility: true,
    cofounderOpen: true,
    badges: ["verified_utility", "top_10_builder", "cofounder_open"],
    xp: 940,
  },
  {
    id: "usr_kabir",
    handle: "kabir",
    displayName: "Kabir Verma",
    role: "builder",
    bio: "CLI minimalist. Rust + Docker tools for messy data files.",
    verifiedUtility: true,
    cofounderOpen: false,
    badges: ["verified_utility", "streak_7d"],
    xp: 810,
  },
  {
    id: "usr_devika",
    handle: "devika",
    displayName: "Devika Nair",
    role: "both",
    bio: "First-25 Scout on 40+ indie tools. Breaking APIs so users don't have to.",
    verifiedUtility: true,
    cofounderOpen: false,
    badges: ["first_25_scout", "bug_hunter", "streak_7d"],
    xp: 2150,
  },
  {
    id: "usr_rohan",
    handle: "rohan",
    displayName: "Rohan Kulkarni",
    role: "builder",
    bio: "Solo student builder — zero followers, shipping my first container tool!",
    verifiedUtility: false,
    cofounderOpen: true,
    badges: ["cofounder_open"],
    xp: 120,
  },
];

// Generate 30 users total
export const SEED_USERS: User[] = Array.from({ length: 30 }, (_, idx) => {
  const preset = SEED_USER_SPECS[idx];
  const handle = preset?.handle ?? `builder_${idx + 1}`;
  const id = preset?.id ?? `usr_${idx + 1}`;
  const isColdStart = idx >= 24; // Last 6 users are 0-follower cold-start builders
  return {
    id,
    handle,
    displayName: preset?.displayName ?? `Indie Builder #${idx + 1}`,
    avatarUrl: `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(handle)}`,
    role: preset?.role ?? (idx % 3 === 0 ? "tester" : "builder"),
    bio:
      preset?.bio ??
      (isColdStart
        ? "New indie builder on Arrakis — try my first micro-demo in 1 tap!"
        : "Building practical micro-tools for everyday problems."),
    githubUrl: `https://github.com/${handle}`,
    followersCount: isColdStart ? 0 : Math.floor(15 + (30 - idx) * 9),
    followingCount: Math.floor(8 + (idx % 12) * 3),
    scoutXp: preset?.xp ?? Math.floor(100 + ((30 - idx) * 65) % 1500),
    builderScore: isColdStart ? 18.4 : Number((95 - idx * 2.3).toFixed(2)),
    verifiedUtility: preset?.verifiedUtility ?? (!isColdStart && idx % 2 === 0),
    cofounderOpen: preset?.cofounderOpen ?? idx % 4 === 0,
    badges:
      preset?.badges ??
      (isColdStart
        ? ["cofounder_open"]
        : idx % 2 === 0
          ? ["verified_utility", "first_25_scout"]
          : ["first_25_scout"]),
    createdAt: new Date(Date.now() - (35 - idx) * 86400_000).toISOString(),
  };
});

export const SEED_USER_VECTORS: Record<string, number[]> = Object.fromEntries(
  SEED_USERS.map((u, idx) => [u.id, makeUnitVector(idx + 1, idx % 6)])
);

function toUserRef(u: User): UserRef {
  return {
    id: u.id,
    handle: u.handle,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    verifiedUtility: u.verifiedUtility,
  };
}

interface FlagshipPostTemplate {
  id: string;
  authorId: string;
  title: string;
  problemStatement: string;
  category: (typeof CATEGORIES)[number];
  mode: DemoMode;
  target: string;
  formSchema?: FormFieldSchema[];
  sampleCommand?: string;
  tags: string[];
  uptimePct: number;
  p50: number;
  p95: number;
}

const FLAGSHIP_POSTS: FlagshipPostTemplate[] = [
  {
    id: "post_resume_json",
    authorId: "usr_aanya",
    title: "Resume2Schema — Convert messy PDF resumes into strict JSON",
    problemStatement:
      "Convert unstructured PDF or plain-text resumes into validated JSON Resume schema in under 1 second without manual copy-pasting.",
    category: "Document & PDF",
    mode: "container",
    target: "arrakis/resume2schema:latest",
    formSchema: [
      {
        name: "resumeText",
        label: "Paste raw resume snippet",
        type: "text",
        required: true,
        defaultValue: "Aanya Sharma | B.Tech CSE 2026 | Built distributed PDF parser in Rust (12k req/s)",
      },
      {
        name: "strictMode",
        label: "Strict JSON Schema validation",
        type: "boolean",
        required: false,
        defaultValue: true,
      },
    ],
    sampleCommand: "resume2schema --input stdin --format json-resume",
    tags: ["resume", "json", "pdf", "parser"],
    uptimePct: 99.4,
    p50: 142,
    p95: 310,
  },
  {
    id: "post_csv_surgeon",
    authorId: "usr_kabir",
    title: "CSV Surgeon — Fix broken encodings, dedupe rows & emit SQL DDL",
    problemStatement:
      "Clean corrupted CSV exports with mixed date formats, duplicate rows, and broken UTF-8 characters, and output ready-to-run Postgres DDL.",
    category: "Data & CSV",
    mode: "container",
    target: "arrakis/csv-surgeon:latest",
    formSchema: [
      {
        name: "csvSample",
        label: "CSV rows (header + sample)",
        type: "text",
        required: true,
        defaultValue: "id,name,signup_date,amount\n1,Ritam,2026/10/31,$42.50\n1,Ritam,31-10-2026,$42.50",
      },
      {
        name: "dialect",
        label: "Target SQL dialect",
        type: "select",
        required: true,
        defaultValue: "postgres",
        options: ["postgres", "sqlite", "duckdb"],
      },
    ],
    sampleCommand: "csv-surgeon --dedupe --infer-ddl --dialect postgres",
    tags: ["csv", "sql", "data-cleaning", "cli"],
    uptimePct: 98.9,
    p50: 118,
    p95: 265,
  },
  {
    id: "post_env_doctor",
    authorId: "usr_srinjoy",
    title: "EnvDoctor — Detect missing, leaked, or mismatched .env keys across monorepos",
    problemStatement:
      "Scan project .env.example files and source references to catch missing environment variables and accidental secret patterns before deployment.",
    category: "Security & Privacy",
    mode: "container",
    target: "arrakis/env-doctor:latest",
    formSchema: [
      {
        name: "envContent",
        label: ".env snippet to audit",
        type: "text",
        required: true,
        defaultValue: "DATABASE_URL=postgresql://localhost:5432/app\nPORT=3000\nSTRIPE_KEY=sk_test_51H...",
      },
    ],
    sampleCommand: "env-doctor audit --redact-secrets",
    tags: ["security", "dotenv", "devops", "linter"],
    uptimePct: 99.8,
    p50: 95,
    p95: 190,
  },
  {
    id: "post_cron_human",
    authorId: "usr_rohan",
    title: "CronSpeak — Turn natural English schedules into tested cron + systemd timers",
    problemStatement:
      "Translate plain English scheduling rules like 'every weekday at 9:15am IST except bank holidays' into cron expressions with next-10 firing timestamps.",
    category: "Productivity & Automation",
    mode: "api",
    target: "https://demo.arrakis.dev/api/cronspeak",
    formSchema: [
      {
        name: "scheduleText",
        label: "Describe when the job should run",
        type: "text",
        required: true,
        defaultValue: "Every Monday and Thursday at 9:30 AM IST",
      },
    ],
    tags: ["cron", "scheduling", "automation"],
    uptimePct: 96.5,
    p50: 210,
    p95: 480,
  },
  {
    id: "post_svg_Minify_canvas",
    authorId: "usr_ritam",
    title: "VectorDiet — Interactive SVG path simplifier & React component generator",
    problemStatement:
      "Shrink bloated Figma/Illustrator SVG exports by up to 80% while previewing visual fidelity side-by-side and copying accessible React components.",
    category: "Design & Media",
    mode: "web",
    target: "https://demo.arrakis.dev/sandbox/vectordiet",
    tags: ["svg", "design-engineering", "accessibility", "frontend"],
    uptimePct: 99.6,
    p50: 130,
    p95: 250,
  },
  {
    id: "post_invoice_chaser",
    authorId: "usr_aanya",
    title: "LedgerPing — Extract line items from freelance invoices & draft polite reminders",
    problemStatement:
      "Parse overdue PDF/email invoices into structured due dates and generate polite, context-aware payment follow-up drafts automatically.",
    category: "Productivity & Automation",
    mode: "api",
    target: "https://demo.arrakis.dev/api/ledgerping",
    formSchema: [
      {
        name: "invoiceSummary",
        label: "Invoice line & due date",
        type: "text",
        required: true,
        defaultValue: "INV-204 • Landing page redesign • $650 • Due 14 days ago",
      },
    ],
    tags: ["invoices", "freelance", "automation", "pdf"],
    uptimePct: 97.8,
    p50: 225,
    p95: 510,
  },
];

const EXTRA_PROBLEMS: Array<{
  title: string;
  problem: string;
  category: (typeof CATEGORIES)[number];
  mode: DemoMode;
  tags: string[];
}> = [
  {
    title: "GitBisect Replay — Find the exact commit that broke your JSON API response",
    problem: "Automatically replay a curl request against recent git commits in a container to pinpoint regressions.",
    category: "Developer Tools",
    mode: "container",
    tags: ["git", "debugging", "regression"],
  },
  {
    title: "TableSnap — Extract HTML/Markdown tables from screenshots of research papers",
    problem: "Turn dense academic PDF tables into clean Markdown or Pandas DataFrames without retyping numbers.",
    category: "Document & PDF",
    mode: "api",
    tags: ["ocr", "markdown", "tables", "research"],
  },
  {
    title: "CORS-Explain — Paste a failed fetch error and get the exact server header fix",
    problem: "Diagnose opaque browser CORS preflight failures and generate exact Nginx, Fastify, or Next.js headers.",
    category: "Developer Tools",
    mode: "web",
    tags: ["cors", "http", "debugging"],
  },
  {
    title: "LogSlim — Deduplicate 100k-line stack traces into 5 root-cause clusters",
    problem: "Compress noisy production container logs into unique stack-trace signatures so you find crashes fast.",
    category: "Data & CSV",
    mode: "container",
    tags: ["logs", "observability", "cli"],
  },
  {
    title: "ContrastFix — Suggest the closest WCAG AA/AAA accessible color palette tokens",
    problem: "Fix low-contrast UI design tokens while preserving the original hue and brand personality.",
    category: "Design & Media",
    mode: "web",
    tags: ["accessibility", "wcag", "colors", "ui"],
  },
  {
    title: "PII-Scrub — Redact phone numbers, Aadhaar/PAN, and emails before LLM prompts",
    problem: "Strip sensitive personal identifiers from customer support tickets locally before calling external APIs.",
    category: "Security & Privacy",
    mode: "container",
    tags: ["privacy", "redaction", "security"],
  },
];

// Generate 60 posts total
export const SEED_POSTS: Post[] = Array.from({ length: 60 }, (_, idx) => {
  const flagship = FLAGSHIP_POSTS[idx];
  const template = EXTRA_PROBLEMS[idx % EXTRA_PROBLEMS.length]!;
  const author = flagship
    ? SEED_USERS.find((u) => u.id === flagship.authorId)!
    : SEED_USERS[idx % SEED_USERS.length]!;

  const id = flagship?.id ?? `post_${idx + 1}`;
  const mode: DemoMode = flagship?.mode ?? template.mode;
  const views = Math.floor(320 + ((60 - idx) * 47) % 2400);
  const tries = Math.floor(views * (0.28 + (idx % 5) * 0.04));
  const trialUpvotes = Math.floor(tries * 0.62);
  const passiveUpvotes = Math.floor(views * 0.08);
  const upvotes = trialUpvotes + passiveUpvotes;
  const uptimePct = flagship?.uptimePct ?? Number((92 + (idx % 8) * 0.9).toFixed(1));
  const verifiedUtility = uptimePct >= 85 && tries >= 20;

  // Proof-of-Trial PostScore preview
  const weightedVotes = trialUpvotes * 3 + passiveUpvotes;
  const postScore = Number(
    (Math.log(1 + weightedVotes) * (0.5 + 0.85) * (1 + 0.3 * (tries / Math.max(views, 1))) * 10).toFixed(2)
  );

  // Dual-Scoring Engine fields (Spop, Suse, Daily Leaderboard)
  const projectType: SandboxProjectType = mode === "web" ? "BROWSER" : "CONTAINER";
  const impressions = views;
  const videoCompletions = Math.floor(views * 0.65);
  const sandboxBounces = Math.max(1, Math.floor(tries * 0.14));
  const sandboxSingleRuns = Math.floor(tries * 0.56);
  const sandboxMultiRuns = Math.max(1, tries - sandboxBounces - sandboxSingleRuns);
  const desktopHandoffs = mode === "handoff" ? Math.floor(tries * 0.35) : Math.floor(tries * 0.08);
  const proxySuccessRate = Number((uptimePct / 100).toFixed(3));
  const weightedUsabilityTags = Number((trialUpvotes * 1.4).toFixed(1));
  const commentsCount = Math.floor(tries * 0.18);
  const sharesCount = Math.max(2, Math.floor(tries * 0.12));

  const popularityScore = Number(
    (
      weightedVotes +
      0.5 * videoCompletions +
      2.0 * commentsCount +
      3.0 * sharesCount
    ).toFixed(2)
  );

  const priorC = 50.0;
  const globalMeanM = 1.2;
  const rawUsability =
    -1.0 * sandboxBounces +
    3.0 * sandboxSingleRuns +
    7.0 * sandboxMultiRuns +
    10.0 * desktopHandoffs +
    weightedUsabilityTags +
    priorC * globalMeanM;
  const usabilityScore = Number(
    (proxySuccessRate * (Math.max(0, rawUsability) / (impressions + priorC))).toFixed(2)
  );

  const ageHours = idx * 3;
  const dailyLeaderboardScore = Number(
    (
      (0.4 * Math.log(Math.max(popularityScore, 1.0)) + 0.6 * usabilityScore) /
      Math.pow(ageHours + 2.0, 1.5)
    ).toFixed(4)
  );

  return {
    id,
    authorId: author.id,
    author: toUserRef(author),
    title: flagship?.title ?? `${template.title} (#${idx + 1})`,
    problemStatement: flagship?.problemStatement ?? template.problem,
    category: flagship?.category ?? template.category,
    videoUrl: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4#t=${(idx % 5) * 2}`,
    thumbUrl: `https://picsum.photos/seed/${encodeURIComponent(id)}/720/1280`,
    durationSec: 45 + (idx % 60),
    demo: {
      mode,
      target:
        flagship?.target ??
        (mode === "container"
          ? `arrakis/demo-${idx + 1}:latest`
          : `https://demo.arrakis.dev/${mode}/${id}`),
      formSchema:
        flagship?.formSchema ??
        (mode === "container" || mode === "api"
          ? [
              {
                name: "input",
                label: "Sample input payload",
                type: "text",
                required: true,
                defaultValue: "Sample input for instant 1-tap trial",
              },
            ]
          : undefined),
      sampleCommand: flagship?.sampleCommand ?? `run-tool --input "sample"`,
    },
    tags: flagship?.tags ?? template.tags,
    indexingStatus: "ready",
    stats: {
      views,
      tries,
      upvotes,
      trialUpvotes,
      comments: commentsCount,
    },
    health: {
      uptimePct,
      p50LatencyMs: flagship?.p50 ?? 140 + (idx % 7) * 25,
      p95LatencyMs: flagship?.p95 ?? 320 + (idx % 7) * 45,
      crashRate: Number(((100 - uptimePct) / 100).toFixed(3)),
      verifiedUtility,
    },
    postScore,
    projectType,
    impressions,
    videoCompletions,
    sandboxBounces,
    sandboxSingleRuns,
    sandboxMultiRuns,
    desktopHandoffs,
    proxySuccessRate,
    weightedUpvotes: weightedVotes,
    weightedUsabilityTags,
    sharesCount,
    popularityScore,
    usabilityScore,
    dailyLeaderboardScore,
    createdAt: new Date(Date.now() - idx * 3600_000 * 3).toISOString(),
  };
});

export const SEED_POST_VECTORS: Record<string, number[]> = Object.fromEntries(
  SEED_POSTS.map((p, idx) => {
    const catIdx = Math.max(0, CATEGORIES.indexOf(p.category as (typeof CATEGORIES)[number]));
    return [p.id, makeUnitVector(idx + 100, catIdx)];
  })
);

// Generate 200 deterministic follows (ensuring usr_ritam follows usr_aanya, usr_srinjoy, usr_kabir, usr_devika)
export const SEED_FOLLOWS: Array<{ followerId: string; followeeId: string; createdAt: string }> = (() => {
  const pairs = new Set<string>();
  const list: Array<{ followerId: string; followeeId: string; createdAt: string }> = [];

  const addFollow = (followerId: string, followeeId: string) => {
    if (followerId === followeeId) return;
    const key = `${followerId}->${followeeId}`;
    if (pairs.has(key)) return;
    pairs.add(key);
    list.push({
      followerId,
      followeeId,
      createdAt: new Date(Date.now() - list.length * 1800_000).toISOString(),
    });
  };

  // Pin flagship demo relationships for @ritam and @srinjoy
  addFollow("usr_ritam", "usr_aanya");
  addFollow("usr_ritam", "usr_srinjoy");
  addFollow("usr_ritam", "usr_kabir");
  addFollow("usr_ritam", "usr_devika");
  addFollow("usr_srinjoy", "usr_ritam");
  addFollow("usr_srinjoy", "usr_aanya");
  addFollow("usr_aanya", "usr_kabir");
  addFollow("usr_devika", "usr_aanya");

  // Fill up to 200 follows among the first 24 users (leaving users 25..30 as true 0-follower cold-start builders!)
  for (let i = 0; i < 24 && list.length < 200; i++) {
    for (let j = 1; j < 24 && list.length < 200; j++) {
      const f1 = SEED_USERS[i]!.id;
      const f2 = SEED_USERS[(i + j * 5) % 24]!.id;
      addFollow(f1, f2);
    }
  }
  return list;
})();

// Generate sample events
export const SEED_EVENTS: TelemetryEvent[] = SEED_POSTS.slice(0, 25).flatMap((post, idx) => [
  {
    id: `evt_view_${idx}`,
    userId: "usr_ritam",
    postId: post.id,
    type: "view",
    value: 0.2,
    ts: new Date(Date.now() - idx * 600_000).toISOString(),
  },
  {
    id: `evt_try_${idx}`,
    userId: idx % 2 === 0 ? "usr_devika" : "usr_aanya",
    postId: post.id,
    type: "try",
    value: 0.6,
    ts: new Date(Date.now() - idx * 500_000).toISOString(),
  },
]);

/**
 * Assemble the 80/20 Home Feed with explicit Reason attribution chips
 */
export function getMockHomeFeed(
  viewerId = "usr_ritam",
  mode: "for_you" | "following" = "for_you",
  cursor?: string | null
): FeedResponse {
  const offset = cursor ? Number.parseInt(cursor, 10) || 0 : 0;
  const pageSize = 10;

  const followedIds = new Set(
    SEED_FOLLOWS.filter((f) => f.followerId === viewerId).map((f) => f.followeeId)
  );
  const viewerVec = SEED_USER_VECTORS[viewerId] ?? SEED_USER_VECTORS["usr_ritam"]!;

  const coldStartAuthorIds = new Set(
    SEED_USERS.filter((u) => u.followersCount === 0).map((u) => u.id)
  );

  let pool = SEED_POSTS.filter((p) => p.authorId !== viewerId || mode === "for_you");
  if (mode === "following") {
    pool = SEED_POSTS.filter((p) => followedIds.has(p.authorId));
  }

  const items: FeedItem[] = pool.slice(offset, offset + pageSize).map((post, idx) => {
    const isColdStartSlot = mode === "for_you" && (idx === 2 || idx === 7); // 2 of 10 = 20% Cold-Start guarantee
    let targetPost = post;

    if (isColdStartSlot) {
      const coldPosts = SEED_POSTS.filter((cp) => coldStartAuthorIds.has(cp.authorId));
      if (coldPosts.length > 0) {
        targetPost = coldPosts[(offset + idx) % coldPosts.length]!;
      }
    }

    const sim = Number(
      Math.max(0.72, cosineSim(viewerVec, SEED_POST_VECTORS[targetPost.id] ?? viewerVec)).toFixed(2)
    );

    let reason: Reason;
    if (isColdStartSlot || coldStartAuthorIds.has(targetPost.authorId)) {
      reason = {
        kind: "coldstart",
        text: `Fresh builder · 20% Cold-Start Spotlight (@${targetPost.author.handle})`,
      };
    } else if (followedIds.has(targetPost.authorId)) {
      reason = {
        kind: "followed",
        via: targetPost.author,
        text: `Recommended because you follow @${targetPost.author.handle}`,
      };
    } else if (idx % 3 === 1) {
      const viaUser = SEED_USERS.find((u) => u.id === "usr_devika")!;
      reason = {
        kind: "followed",
        via: toUserRef(viaUser),
        text: `Recommended because @${viaUser.handle} tried & verified this`,
      };
    } else if (idx % 4 === 0) {
      reason = {
        kind: "taste",
        matchedTopic: targetPost.category,
        similarity: sim,
        text: `Matches tools you tried in ${targetPost.category} (${Math.round(sim * 100)}% match)`,
      };
    } else {
      reason = {
        kind: "trending",
        text: `High Proof-of-Trial velocity (${targetPost.stats.trialUpvotes} verified tester upvotes)`,
      };
    }

    return {
      post: targetPost,
      reason,
      viewerState: {
        upvoted: idx === 0,
        tried: idx === 0,
        saved: false,
        followingAuthor: followedIds.has(targetPost.authorId),
      },
    };
  });

  const nextCursor = offset + pageSize < pool.length ? String(offset + pageSize) : null;
  return { items, nextCursor, mode };
}

/**
 * Global Feed / Hybrid Problem-First Search
 */
export function getMockGlobalFeed(query?: string, modeFilter?: DemoMode, categoryFilter?: string): FeedResponse {
  const q = query?.trim().toLowerCase() ?? "";
  let filtered = SEED_POSTS.filter((p) => {
    if (modeFilter && p.demo.mode !== modeFilter) return false;
    if (categoryFilter && p.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.problemStatement.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  if (filtered.length === 0 && q) {
    // Semantic fallback: return top 5 utility posts with a similarity explanation
    filtered = SEED_POSTS.slice(0, 5);
  }

  const items: FeedItem[] = filtered.slice(0, 20).map((post, idx) => ({
    post,
    reason: q
      ? {
          kind: "search",
          matchedTopic: q,
          similarity: Number((0.94 - idx * 0.03).toFixed(2)),
          text: `Solves "${q}" · ${Math.round((0.94 - idx * 0.03) * 100)}% problem match`,
        }
      : {
          kind: "trending",
          text: `${post.health.uptimePct}% live demo uptime · ${post.stats.tries} instant trials`,
        },
  }));

  return {
    items,
    nextCursor: null,
    mode: "global",
  };
}

/**
 * Classify outer-shell telemetry session into BOUNCE | SINGLE | MULTI tier
 */
export function classifyTelemetryRunTier(
  payload: Pick<
    TelemetryPayload,
    "active_dwell_seconds" | "interaction_bursts" | "switched_to_landscape"
  >
): RunTier {
  if (payload.active_dwell_seconds < 5 || payload.interaction_bursts === 0) {
    return "BOUNCE";
  }
  if (
    payload.active_dwell_seconds >= 45 &&
    (payload.interaction_bursts >= 3 || payload.switched_to_landscape === true)
  ) {
    return "MULTI";
  }
  if (payload.active_dwell_seconds >= 15 && payload.interaction_bursts >= 1) {
    return "SINGLE";
  }
  return "BOUNCE";
}

export function getQuickFeedbackTagDelta(tag: QuickFeedbackTag): number {
  if (tag === "WORKS_GREAT") return 2.0;
  if (tag === "BUGGY") return -3.0;
  return 0.0;
}

/**
 * Element-wise Exponential Moving Average (EMA) for user intent vector
 */
export function updateEmaVector(
  userVec: number[] | null | undefined,
  projectVec: number[],
  runTier: RunTier
): number[] {
  if (!userVec || userVec.length === 0) {
    return [...projectVec];
  }
  const alpha = runTier === "MULTI" ? 0.3 : 0.15;
  const len = Math.min(userVec.length, projectVec.length);
  const next: number[] = [];
  for (let i = 0; i < len; i++) {
    next.push(Number(((1 - alpha) * userVec[i]! + alpha * projectVec[i]!).toFixed(4)));
  }
  return next;
}

/**
 * Leaderboard generator (Builders / Testers / Trending / Most Useful / Most Popular)
 */
export function getMockLeaderboard(
  type: LeaderboardType = "builders",
  period: LeaderboardPeriod = "7d",
  viewerId = "usr_ritam",
  postsOverride?: Post[]
): LeaderboardResponse {
  const postsList = postsOverride ?? SEED_POSTS;
  if (type === "trending" || type === "useful" || type === "popular") {
    const sortedPosts = [...postsList]
      .sort((a, b) => {
        if (type === "useful") return (b.usabilityScore ?? 0) - (a.usabilityScore ?? 0);
        if (type === "popular") return (b.popularityScore ?? 0) - (a.popularityScore ?? 0);
        return (b.dailyLeaderboardScore ?? b.postScore) - (a.dailyLeaderboardScore ?? a.postScore);
      })
      .slice(0, 15);
    const rows: LeaderboardRow[] = sortedPosts.map((post, idx) => {
      const rank = idx + 1;
      const prevRank = Math.max(1, rank + (idx % 3 === 0 ? 2 : idx % 3 === 1 ? -1 : 0));
      const passive = post.stats.upvotes - post.stats.trialUpvotes;
      const weightedVotes = post.stats.trialUpvotes * 3 + passive;
      const score =
        type === "useful"
          ? Number((post.usabilityScore ?? 0).toFixed(2))
          : type === "popular"
            ? Number((post.popularityScore ?? 0).toFixed(1))
            : post.postScore;
      return {
        rank,
        prevRank,
        delta: prevRank - rank,
        entityType: "post",
        post,
        user: SEED_USERS.find((u) => u.id === post.authorId),
        score,
        breakdown: {
          weightedVotes,
          passiveUpvotes: passive,
          trialUpvotes3x: post.stats.trialUpvotes,
          trialConversionRate: Number((post.stats.tries / Math.max(post.stats.views, 1)).toFixed(2)),
          workedRate: 0.94,
          uptimePct: post.health.uptimePct,
          freshnessDecay: 0.92,
          popularityScore: post.popularityScore,
          usabilityScore: post.usabilityScore,
          dailyLeaderboardScore: post.dailyLeaderboardScore,
          formulaSummary:
            type === "useful"
              ? `Usability S_use=${(post.usabilityScore ?? 0).toFixed(2)} · ${post.sandboxMultiRuns ?? 0} multi-runs · ${post.health.uptimePct}% proxy health`
              : type === "popular"
                ? `Popularity S_pop=${(post.popularityScore ?? 0).toFixed(0)} · ${weightedVotes} weighted votes · ${post.sharesCount ?? 0} shares`
                : `${post.stats.trialUpvotes} trial upvotes (×3) + ${passive} passive (×1) · S_use=${(post.usabilityScore ?? 0).toFixed(2)}`,
        },
      };
    });
    return { type, period, updatedAt: new Date().toISOString(), rows };
  }

  const sortedUsers = [...SEED_USERS].sort((a, b) =>
    type === "testers" ? b.scoutXp - a.scoutXp : b.builderScore - a.builderScore
  );

  const rows: LeaderboardRow[] = sortedUsers.slice(0, 15).map((user, idx) => {
    const rank = idx + 1;
    const prevRank = Math.max(1, rank + (idx % 2 === 0 ? 1 : -1));
    const score = type === "testers" ? user.scoutXp : user.builderScore;
    const breakdown: ScoreBreakdown = {
      weightedVotes: 140 - idx * 6,
      passiveUpvotes: 22,
      trialUpvotes3x: 39 - idx,
      trialConversionRate: 0.34,
      workedRate: 0.95,
      uptimePct: 99.1,
      freshnessDecay: 0.96,
      formulaSummary:
        type === "testers"
          ? `${Math.floor(user.scoutXp / 25)} verified micro-reviews + First-25 Scout bonuses`
          : `Top-5 Proof-of-Trial projects + >98% live sandbox uptime`,
    };
    return {
      rank,
      prevRank,
      delta: prevRank - rank,
      entityType: "user",
      user,
      score,
      breakdown,
    };
  });

  const me = rows.find((r) => r.user?.id === viewerId) ?? rows[0];
  return {
    type,
    period,
    updatedAt: new Date().toISOString(),
    rows,
    me,
  };
}

/**
 * Profile response helper
 */
export function getMockProfile(handleOrId: string, viewerId = "usr_ritam"): ProfileResponse {
  const user =
    SEED_USERS.find((u) => u.id === handleOrId || u.handle.toLowerCase() === handleOrId.toLowerCase()) ??
    SEED_USERS[0]!;
  const isFollowing = SEED_FOLLOWS.some((f) => f.followerId === viewerId && f.followeeId === user.id);
  const projects = SEED_POSTS.filter((p) => p.authorId === user.id);
  const triedPosts = SEED_POSTS.slice(0, 4);
  const recentReviews: Review[] = triedPosts.map((p, idx) => ({
    id: `rev_${user.id}_${idx}`,
    runId: `run_seed_${idx}`,
    userId: user.id,
    postId: p.id,
    worked: true,
    wouldUse: idx % 3 !== 2,
    bug: idx === 1 ? "Edge case when input contains trailing newline" : undefined,
    xpAwarded: idx === 0 ? 125 : 25,
    createdAt: new Date(Date.now() - idx * 7200_000).toISOString(),
  }));

  return {
    user,
    isFollowing,
    rank: {
      builderRank: Math.max(1, SEED_USERS.findIndex((u) => u.id === user.id) + 1),
      testerRank: Math.max(1, SEED_USERS.findIndex((u) => u.id === user.id) + 2),
      percentile: 96,
    },
    projects: projects.length > 0 ? projects : SEED_POSTS.slice(0, 3),
    triedPosts,
    recentReviews,
  };
}

/**
 * Canned SSE terminal stream for Mock Mode Sandbox (unblocks UI Try-It overlay immediately)
 */
export function getMockTrialStreamEvents(runId: string, postId: string, payload?: Record<string, unknown>): SseStreamEvent[] {
  const post = SEED_POSTS.find((p) => p.id === postId) ?? SEED_POSTS[0]!;
  const now = Date.now();
  const inputPreview = payload ? JSON.stringify(payload) : '{"sample":true}';

  return [
    {
      type: "status",
      runId,
      timestamp: new Date(now).toISOString(),
      status: "starting",
      stream: "system",
      line: `[arrakis-sandbox] Pulling warm image ${post.demo.target} (cap-drop=ALL, read-only, 256MB RAM, 60s TTL)...`,
    },
    {
      type: "status",
      runId,
      timestamp: new Date(now + 120).toISOString(),
      status: "running",
      stream: "system",
      line: `[arrakis-sandbox] Container started in 118ms · network=arrakis-sandbox (egress-guarded)`,
    },
    {
      type: "log",
      runId,
      timestamp: new Date(now + 240).toISOString(),
      stream: "stdout",
      line: `$ ${post.demo.sampleCommand ?? "run-demo"} --payload '${inputPreview}'`,
    },
    {
      type: "log",
      runId,
      timestamp: new Date(now + 410).toISOString(),
      stream: "stdout",
      line: `[info] Validating input schema and executing utility pipeline...`,
    },
    {
      type: "result",
      runId,
      timestamp: new Date(now + 560).toISOString(),
      stream: "stdout",
      line: `[ok] Completed in ${post.health.p50LatencyMs}ms (exit 0)`,
      output: {
        tool: post.title,
        problemSolved: post.problemStatement,
        inputReceived: payload ?? { default: true },
        structuredResult: {
          status: "verified_ok",
          itemsProcessed: 1,
          latencyMs: post.health.p50LatencyMs,
          summary: "Output generated inside isolated Arrakis ephemeral sandbox.",
        },
      },
    },
    {
      type: "health",
      runId,
      timestamp: new Date(now + 600).toISOString(),
      status: "succeeded",
      health: post.health,
    },
  ];
}

export function createMockTrialRun(userId: string, postId: string, baseUrl = "http://localhost:4002"): TrialRun {
  const post = SEED_POSTS.find((p) => p.id === postId) ?? SEED_POSTS[0]!;
  const id = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    userId,
    postId: post.id,
    mode: post.demo.mode,
    status: "queued",
    queuePosition: 0,
    streamUrl: `${baseUrl}/try/${id}/stream?postId=${encodeURIComponent(post.id)}`,
    sandboxUrl: post.demo.mode === "web" ? post.demo.target : undefined,
    latencyMs: post.health.p50LatencyMs,
    httpStatus: 200,
    exitCode: 0,
    startedAt: new Date().toISOString(),
  };
}
