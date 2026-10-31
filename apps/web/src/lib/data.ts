import {
  SEED_POSTS,
  SEED_USERS,
  getMockGlobalFeed,
  getMockHomeFeed,
  type DemoMode,
  type FeedResponse,
  type Post,
} from "@arrakis/contracts";

/**
 * Server-side data access. With MOCK=1 (default) everything is served from the
 * shared deterministic seed in @arrakis/contracts; otherwise it calls Dev B's
 * recommender service. Keeps the UI unblocked regardless of backend progress.
 */
const MOCK = process.env.MOCK !== "0";
const RECOMMENDER_URL = process.env.NEXT_PUBLIC_RECOMMENDER_URL ?? "http://localhost:4001";

export async function fetchHomeFeed(
  userId: string,
  mode: "for_you" | "following",
  cursor?: string | null,
): Promise<FeedResponse> {
  if (MOCK) return getMockHomeFeed(userId, mode, cursor ?? null);
  const qs = new URLSearchParams({ userId, mode });
  if (cursor) qs.set("cursor", cursor);
  const res = await fetch(`${RECOMMENDER_URL}/feed/home?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`recommender ${res.status}`);
  return (await res.json()) as FeedResponse;
}

export async function fetchGlobalFeed(params: {
  q?: string;
  mode?: DemoMode;
  category?: string;
}): Promise<FeedResponse> {
  if (MOCK) return getMockGlobalFeed(params.q, params.mode, params.category);
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.mode) qs.set("mode", params.mode);
  if (params.category) qs.set("category", params.category);
  const res = await fetch(`${RECOMMENDER_URL}/feed/global?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`recommender ${res.status}`);
  return (await res.json()) as FeedResponse;
}

/** Posts from builders with zero followers — the "Fresh Builds" rail. */
export function getFreshBuilds(limit = 10): Post[] {
  const cold = new Set(SEED_USERS.filter((u) => u.followersCount === 0).map((u) => u.id));
  return SEED_POSTS.filter((p) => cold.has(p.authorId)).slice(0, limit);
}

export const CATEGORIES = [
  "Developer Tools",
  "Document & PDF",
  "Data & CSV",
  "Productivity & Automation",
  "Design & Media",
  "Security & Privacy",
] as const;
