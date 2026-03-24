import pg from 'pg';
const { Client } = pg;

async function dropAllTables() {
  const client = new Client({
    connectionString: "postgresql://neondb_owner:npg_tFnLiav3dO9Z@ep-snowy-smoke-ai6rt98l-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require",
  });

  try {
    await client.connect();
    console.log("Connected to database");

    const res = await client.query(`
      SELECT tablename FROM pg_catalog.pg_tables 
      WHERE schemaname = 'public';
    `);

    for (const row of res.rows) {
      console.log(`Dropping table: ${row.tablename}`);
      await client.query(`DROP TABLE IF EXISTS "${row.tablename}" CASCADE;`);
    }

    console.log("All tables dropped successfully");
  } catch (err) {
    console.error("Error dropping tables:", err);
  } finally {
    await client.end();
  }
}

dropAllTables();

