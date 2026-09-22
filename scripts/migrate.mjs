import { neon } from "@neondatabase/serverless";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString?.startsWith("postgres")) throw new Error("DATABASE_URL must be a PostgreSQL connection string");
const sql = neon(connectionString);
const directory = path.resolve(process.cwd(), "database");
const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();

await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
for (const file of files) {
  const applied = await sql`SELECT name FROM schema_migrations WHERE name=${file}`;
  if (applied.length) {
    console.log(`skip ${file}`);
    continue;
  }
  const source = await readFile(path.join(directory, file), "utf8");
  const statements = source.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
  for (const statement of statements) await sql.query(statement, []);
  await sql`INSERT INTO schema_migrations(name) VALUES(${file}) ON CONFLICT(name) DO NOTHING`;
  console.log(`applied ${file}`);
}
