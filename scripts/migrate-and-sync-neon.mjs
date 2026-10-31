import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const LOCAL_URL =
  process.env.LOCAL_DATABASE_URL ??
  "postgresql://arrakis:arrakis_dev@localhost:5432/arrakis";

const NEON_URL =
  process.env.NEON_DATABASE_URL ??
  "postgresql://neondb_owner:npg_6KxAsjZ5kJlr@ep-blue-butterfly-b4jxege5-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function main() {
  console.log("=================================================");
  console.log("  Arrakis: Syncing Local Database to Neon Cloud   ");
  console.log("=================================================\n");

  const local = new pg.Client({ connectionString: LOCAL_URL });
  const neon = new pg.Client({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log("1. Connecting to Local Postgres and Neon Cloud Postgres...");
  await local.connect();
  console.log("   ✓ Local Postgres connected");
  await neon.connect();
  console.log("   ✓ Neon Cloud connected\n");

  console.log("2. Ensuring Neon PostgreSQL extensions...");
  await neon.query("CREATE EXTENSION IF NOT EXISTS vector;");
  await neon.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
  await neon.query("CREATE EXTENSION IF NOT EXISTS pg_trgm;");
  console.log("   ✓ vector, pgcrypto, pg_trgm enabled\n");

  console.log("3. Applying migrations to Neon Cloud...");
  const mig0 = fs.readFileSync(
    path.resolve(process.cwd(), "infra/migrations/0000_init.sql"),
    "utf8"
  );
  const mig1 = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "infra/migrations/0001_telemetry_dual_scoring.sql"
    ),
    "utf8"
  );

  console.log("   Applying 0000_init.sql...");
  await neon.query(mig0);
  console.log("   Applying 0001_telemetry_dual_scoring.sql...");
  await neon.query(mig1);
  console.log("   ✓ Schema & RPC functions migrated successfully\n");

  console.log("4. Copying data from Local DB to Neon Cloud...");

  async function copyTable(tableName, conflictTarget) {
    const { rows } = await local.query(`SELECT * FROM "${tableName}"`);
    console.log(`   Transferring ${tableName} (${rows.length} rows)...`);
    if (rows.length === 0) return;

    for (const row of rows) {
      // Exclude generated columns like search_tsv
      const keys = Object.keys(row).filter((k) => k !== "search_tsv");
      const cols = keys.map((k) => `"${k}"`).join(", ");
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      const values = keys.map((k) => {
        const val = row[k];
        if (
          typeof val === "object" &&
          val !== null &&
          !(val instanceof Date) &&
          !Buffer.isBuffer(val)
        ) {
          return JSON.stringify(val);
        }
        return val;
      });

      const onConflict = conflictTarget
        ? `ON CONFLICT (${conflictTarget}) DO UPDATE SET ` +
          keys
            .filter((k) => k !== conflictTarget)
            .map((k) => `"${k}" = EXCLUDED."${k}"`)
            .join(", ")
        : `ON CONFLICT DO NOTHING`;

      const q = `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders}) ${onConflict};`;
      await neon.query(q, values);
    }
  }

  // Copy in dependency order
  await copyTable("users", "id");
  await copyTable("posts", "id");
  await copyTable("post_embeddings", "post_id");
  await copyTable("follows", null);
  await copyTable("events", "id");
  await copyTable("user_impressions", "id");
  await copyTable("reviews", "id");
  await copyTable("trial_runs", "id");

  console.log("   ✓ All tables copied successfully\n");

  console.log("5. Verification of Row Counts on Neon Cloud:");
  const tables = [
    "users",
    "posts",
    "post_embeddings",
    "follows",
    "events",
    "user_impressions",
  ];
  for (const t of tables) {
    const { rows: localCount } = await local.query(
      `SELECT count(*) FROM "${t}"`
    );
    const { rows: neonCount } = await neon.query(`SELECT count(*) FROM "${t}"`);
    console.log(
      `   - ${t.padEnd(18)}: Local = ${localCount[0].count.padStart(3)}, Neon = ${neonCount[0].count.padStart(3)} [${localCount[0].count === neonCount[0].count ? "MATCH" : "MISMATCH"}]`
    );
  }

  console.log("\n6. Running RPC smoke test on Neon Cloud...");
  const { rows: feedTest } = await neon.query(
    "SELECT id, title, usability_score FROM get_personalized_feed('usr_ritam', NULL, 5);"
  );
  console.log(`   ✓ get_personalized_feed returned ${feedTest.length} items`);
  feedTest.forEach((item, i) => {
    console.log(`     [${i + 1}] ${item.id}: ${item.title}`);
  });

  await local.end();
  await neon.end();

  console.log("\n=================================================");
  console.log("  Migration & Sync to Neon Cloud Complete! 🚀     ");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
