import pg from "pg";

const NEON_URL = "postgresql://neondb_owner:npg_u1YVWOaG4Blh@ep-rough-cloud-b7uukapr.c-13.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const c = new pg.Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  await c.query(`
    UPDATE posts SET hackathon_id='hack_arrakis_2026', hackathon_name='Arrakis Flagship Buildathon'
    WHERE id IN ('post_csv_surgeon', 'post_env_doctor');
  `);
  await c.query(`
    INSERT INTO hackathon_projects (hackathon_id, project_id)
    VALUES ('hack_arrakis_2026', 'post_csv_surgeon'), ('hack_arrakis_2026', 'post_env_doctor')
    ON CONFLICT DO NOTHING;
  `);

  await c.query(`
    UPDATE posts SET hackathon_id='hack_agents_sprint', hackathon_name='AI Agents Global Sprint'
    WHERE id IN ('post_7', 'post_8');
  `);
  await c.query(`
    INSERT INTO hackathon_projects (hackathon_id, project_id)
    VALUES ('hack_agents_sprint', 'post_7'), ('hack_agents_sprint', 'post_8')
    ON CONFLICT DO NOTHING;
  `);

  await c.query(`
    UPDATE posts SET hackathon_id='hack_indie_weekend', hackathon_name='Indie Hacker 48h Shipathon'
    WHERE id IN ('post_svg_Minify_canvas', 'post_invoice_chaser');
  `);
  await c.query(`
    INSERT INTO hackathon_projects (hackathon_id, project_id)
    VALUES ('hack_indie_weekend', 'post_svg_Minify_canvas'), ('hack_indie_weekend', 'post_invoice_chaser')
    ON CONFLICT DO NOTHING;
  `);

  console.log("Sample hackathon projects successfully mapped in Neon!");
  await c.end();
}

main().catch(console.error);
