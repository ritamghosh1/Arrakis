import type { Post } from "./types.ts";

const FNV_OFFSET_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/**
 * Strip clone suffixes like "(#14)", normalize case, and collapse whitespace/punctuation.
 */
export function normalizeCanonicalText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\(#\d+\)/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract canonical title stem (before em-dash or colon) so variations of the same tool name collapse.
 */
export function extractTitleStem(title: string): string {
  const cleaned = title.replace(/\(#\d+\)/g, "").trim();
  const [stem] = cleaned.split(/\s*[—–-]\s*|\s*:\s*/);
  return normalizeCanonicalText(stem || cleaned);
}

/**
 * 64-bit FNV-1a hash returning a BigInt.
 */
export function fnv1a64(input: string): bigint {
  let hash = FNV_OFFSET_64;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * FNV_PRIME_64) & MASK_64;
  }
  return hash;
}

/**
 * Deterministic 64-bit hex Content Hash over canonical title stem + problem statement.
 * O(L) time, O(1) space.
 */
export function computeContentHash(post: {
  title: string;
  problemStatement: string;
}): string {
  const stem = extractTitleStem(post.title);
  const prob = normalizeCanonicalText(post.problemStatement);
  const combined = `${stem}::${prob}`;
  return fnv1a64(combined).toString(16).padStart(16, "0");
}

/**
 * 64-bit Charikar Locality-Sensitive SimHash over word & 2-word shingles.
 * Near-duplicate posts produce SimHashes with Hamming distance <= 3.
 */
export function computeSimHash64(post: {
  title: string;
  problemStatement: string;
  category?: string;
  tags?: string[];
}): bigint {
  const stem = extractTitleStem(post.title);
  const titleText = normalizeCanonicalText(post.title);
  const bodyText = normalizeCanonicalText(
    `${post.problemStatement} ${post.category ?? ""} ${(post.tags ?? []).join(" ")}`,
  );
  const titleTokens = `${stem} ${titleText}`.split(" ").filter((t) => t.length >= 2);
  const bodyTokens = bodyText.split(" ").filter((t) => t.length >= 2);
  if (titleTokens.length === 0 && bodyTokens.length === 0) return 0n;

  const weights = new Int32Array(64);
  const addShingle = (shingle: string, weight: number) => {
    const h = fnv1a64(shingle);
    for (let bit = 0; bit < 64; bit++) {
      if ((h >> BigInt(bit)) & 1n) {
        weights[bit]! += weight;
      } else {
        weights[bit]! -= weight;
      }
    }
  };

  for (let i = 0; i < titleTokens.length; i++) {
    const shingle = i + 1 < titleTokens.length ? `t:${titleTokens[i]}_${titleTokens[i + 1]}` : `t:${titleTokens[i]!}`;
    addShingle(shingle, 4);
  }
  for (let i = 0; i < bodyTokens.length; i++) {
    const shingle = i + 1 < bodyTokens.length ? `b:${bodyTokens[i]}_${bodyTokens[i + 1]}` : `b:${bodyTokens[i]!}`;
    addShingle(shingle, 1);
  }

  let simhash = 0n;
  for (let bit = 0; bit < 64; bit++) {
    if (weights[bit]! > 0) {
      simhash |= 1n << BigInt(bit);
    }
  }
  return simhash;
}

/**
 * Fast bitwise Hamming distance between two 64-bit SimHashes.
 */
export function hammingDistance64(a: bigint, b: bigint): number {
  let xor = (a ^ b) & MASK_64;
  let dist = 0;
  while (xor > 0n) {
    xor &= xor - 1n;
    dist++;
  }
  return dist;
}

function unwrapPost<T extends Post | { post: Post }>(item: T): Post {
  return "post" in item && item.post ? item.post : (item as Post);
}

/**
 * Single-pass scalable deduplicator using:
 * 1. Exact Post ID set (O(1))
 * 2. Canonical Title Stem & 64-bit Content Hash set (O(1))
 * 3. 64-bit LSH SimHash Hamming distance <= maxHammingDist
 */
export function deduplicatePosts<T extends Post | { post: Post }>(
  items: readonly T[],
  options?: {
    seenIds?: Set<string>;
    seenContentHashes?: Set<string>;
    maxHammingDist?: number;
  },
): T[] {
  const seenIds = options?.seenIds ?? new Set<string>();
  const seenHashes = options?.seenContentHashes ?? new Set<string>();
  const seenStems = new Set<string>();
  const seenSimHashes: bigint[] = [];
  const maxDist = options?.maxHammingDist ?? 3;

  const result: T[] = [];
  for (const item of items) {
    const post = unwrapPost(item);
    if (seenIds.has(post.id)) continue;

    const stem = extractTitleStem(post.title);
    const contentHash = computeContentHash(post);
    if (seenHashes.has(contentHash) || (stem.length >= 4 && seenStems.has(stem))) {
      continue;
    }

    const simHash = computeSimHash64(post);
    const isNearDuplicate = seenSimHashes.some((prev) => hammingDistance64(simHash, prev) <= maxDist);
    if (isNearDuplicate) {
      continue;
    }

    seenIds.add(post.id);
    seenHashes.add(contentHash);
    if (stem.length >= 4) seenStems.add(stem);
    seenSimHashes.push(simHash);
    result.push(item);
  }

  return result;
}

/**
 * Bounded per-user ring-buffer tracker for scalable O(1) seen-post and content-hash tracking.
 */
export class ScalableImpressionTracker {
  private readonly maxPerUser: number;
  private readonly userIds = new Map<string, Set<string>>();
  private readonly userHashes = new Map<string, Set<string>>();

  constructor(maxPerUser = 2000) {
    this.maxPerUser = maxPerUser;
  }

  record(userId: string, post: Pick<Post, "id" | "title" | "problemStatement">): void {
    let ids = this.userIds.get(userId);
    if (!ids) {
      ids = new Set<string>();
      this.userIds.set(userId, ids);
    }
    if (ids.size >= this.maxPerUser) {
      const oldest = ids.values().next().value;
      if (oldest) ids.delete(oldest);
    }
    ids.add(post.id);

    let hashes = this.userHashes.get(userId);
    if (!hashes) {
      hashes = new Set<string>();
      this.userHashes.set(userId, hashes);
    }
    if (hashes.size >= this.maxPerUser) {
      const oldestHash = hashes.values().next().value;
      if (oldestHash) hashes.delete(oldestHash);
    }
    hashes.add(computeContentHash(post));
  }

  hasSeen(userId: string, post: Pick<Post, "id" | "title" | "problemStatement">): boolean {
    const ids = this.userIds.get(userId);
    if (ids?.has(post.id)) return true;
    const hashes = this.userHashes.get(userId);
    if (hashes?.has(computeContentHash(post))) return true;
    return false;
  }

  clearUser(userId: string): void {
    this.userIds.delete(userId);
    this.userHashes.delete(userId);
  }
}
