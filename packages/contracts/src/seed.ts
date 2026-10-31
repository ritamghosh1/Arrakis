import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SEED_EVENTS,
  SEED_FOLLOWS,
  SEED_POSTS,
  SEED_POST_VECTORS,
  SEED_USERS,
  SEED_USER_VECTORS,
  getMockHomeFeed,
  getMockLeaderboard,
} from "./mocks/seed-data.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedDir = resolve(__dirname, "../../../infra/seed");

async function main() {
  mkdirSync(seedDir, { recursive: true });

  const files: Record<string, unknown> = {
    "users.json": SEED_USERS,
    "posts.json": SEED_POSTS,
    "follows.json": SEED_FOLLOWS,
    "events.json": SEED_EVENTS,
    "user_vectors.json": SEED_USER_VECTORS,
    "post_vectors.json": SEED_POST_VECTORS,
    "sample_home_feed_ritam.json": getMockHomeFeed("usr_ritam", "for_you"),
    "sample_leaderboard_builders.json": getMockLeaderboard("builders", "7d", "usr_ritam"),
  };

  for (const [filename, payload] of Object.entries(files)) {
    const outPath = resolve(seedDir, filename);
    writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  }

  console.log(
    `[arrakis:seed] Wrote deterministic seed files to ${seedDir}:\n` +
      `  - ${SEED_USERS.length} users (including @ritam, @srinjoy, @aanya, @kabir, @devika)\n` +
      `  - ${SEED_POSTS.length} utility posts (container | api | web | handoff)\n` +
      `  - ${SEED_FOLLOWS.length} social follows\n` +
      `  - ${SEED_EVENTS.length} telemetry events`
  );
}

main().catch((err) => {
  console.error("[arrakis:seed] Failed:", err);
  process.exit(1);
});
