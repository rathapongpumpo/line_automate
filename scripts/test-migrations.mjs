import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";
import path from "node:path";

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString?.startsWith("postgres")) throw new Error("TEST_DATABASE_URL or DATABASE_URL is required");
const sql = neon(connectionString);
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const schemas = [`phase0_qa_fresh_${suffix}`, `phase0_qa_upgrade_${suffix}`];
for (const schema of schemas) if (!/^phase0_qa_[a-z0-9_]+$/.test(schema)) throw new Error("Unsafe QA schema name");

const statements = async (file) => (await readFile(path.resolve(process.cwd(), "database", file), "utf8")).split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean);
const baseline = await statements("001_initial.sql");
const phase0 = await statements("002_phase0_line_core.sql");
const identifier = (value) => `"${value}"`;
async function create(schema) { await sql.query(`CREATE SCHEMA ${identifier(schema)}`, []); }
async function drop(schema) { await sql.query(`DROP SCHEMA ${identifier(schema)} CASCADE`, []); }
async function runIn(schema, sources) { await sql.transaction([sql.query(`SET LOCAL search_path TO ${identifier(schema)}`, []), ...sources.map((source) => sql.query(source, []))]); }

try {
  for (const schema of schemas) await create(schema);
  await runIn(schemas[0], [...baseline, ...phase0]);
  const freshColumns = await sql.query(`SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='messages'`, [schemas[0]]);
  if (!freshColumns.some((row) => row.column_name === "delivery_status")) throw new Error("Fresh migration missing delivery_status");

  await runIn(schemas[1], baseline);
  await runIn(schemas[1], [
    `INSERT INTO customers(line_user_id,display_name,name,tags,created_at,updated_at) VALUES('U_QA','Legacy display','Owner name','[]'::jsonb,NOW(),NOW())`,
    `INSERT INTO settings(id,store_name,phone,welcome_message,demo_mode,channel_id,channel_secret,access_token) VALUES(1,'QA','00000000','Legacy welcome message',TRUE,'channel','legacy-secret','legacy-token')`,
  ]);
  await runIn(schemas[1], phase0);
  await runIn(schemas[1], phase0);
  const preserved = await sql.query(`SELECT name FROM ${identifier(schemas[1])}.customers WHERE line_user_id='U_QA'`, []);
  const cleared = await sql.query(`SELECT channel_secret,access_token FROM ${identifier(schemas[1])}.settings WHERE id=1`, []);
  if (preserved[0]?.name !== "Owner name") throw new Error("Upgrade did not preserve customer data");
  if (cleared[0]?.channel_secret !== null || cleared[0]?.access_token !== null) throw new Error("Upgrade did not clear plaintext credentials");
  const schema = identifier(schemas[1]);
  const conversations = await sql.query(`INSERT INTO ${schema}.conversations(customer_id,status,last_message,last_message_at,created_at) SELECT id,'ADMIN','qa',NOW(),NOW() FROM ${schema}.customers WHERE line_user_id='U_QA' RETURNING id`, []);
  const conversationId = Number(conversations[0].id);
  await Promise.all(Array.from({ length: 6 }, () => sql.query(`INSERT INTO ${schema}.leads(customer_id,product,status,source,owner,created_at,updated_at) SELECT id,'QA','NEW','QA','QA',NOW(),NOW() FROM ${schema}.customers WHERE line_user_id='U_QA' ON CONFLICT(customer_id) DO UPDATE SET updated_at=EXCLUDED.updated_at`, [])));
  await Promise.all(Array.from({ length: 6 }, () => sql.query(`INSERT INTO ${schema}.messages(conversation_id,sender,body,created_at,external_id,delivery_status) VALUES($1,'ADMIN','qa',NOW(),'550e8400-e29b-41d4-a716-446655440000','QUEUED') ON CONFLICT(external_id) WHERE external_id IS NOT NULL DO NOTHING`, [conversationId])));
  await Promise.all(Array.from({ length: 6 }, () => sql.query(`INSERT INTO ${schema}.messages(conversation_id,sender,body,created_at,line_message_id,delivery_status) VALUES($1,'CUSTOMER','qa',NOW(),'line-message-qa','RECEIVED') ON CONFLICT(line_message_id) WHERE line_message_id IS NOT NULL DO NOTHING`, [conversationId])));
  await Promise.all(Array.from({ length: 6 }, () => sql.query(`INSERT INTO ${schema}.jobs(job_type,dedupe_key,payload) VALUES('LINE_EVENT','line-event:qa','{}'::jsonb) ON CONFLICT(dedupe_key) DO NOTHING`, [])));
  const leadCount = await sql.query(`SELECT COUNT(*)::int AS count FROM ${schema}.leads`, []);
  const outboundCount = await sql.query(`SELECT COUNT(*)::int AS count FROM ${schema}.messages WHERE external_id IS NOT NULL`, []);
  const inboundCount = await sql.query(`SELECT COUNT(*)::int AS count FROM ${schema}.messages WHERE line_message_id IS NOT NULL`, []);
  const jobCount = await sql.query(`SELECT COUNT(*)::int AS count FROM ${schema}.jobs WHERE dedupe_key='line-event:qa'`, []);
  if (leadCount[0].count !== 1 || outboundCount[0].count !== 1 || inboundCount[0].count !== 1 || jobCount[0].count !== 1) throw new Error("Concurrent dedupe constraints failed");
  console.log("Migration QA passed: fresh, upgrade, repeat, preservation, credential clearing, concurrent dedupe.");
} finally {
  for (const schema of schemas) await drop(schema).catch(() => undefined);
}
