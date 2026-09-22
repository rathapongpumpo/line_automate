import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), process.env.DATABASE_URL || "./data/line-sales-assistant.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (!fs.existsSync(dbPath)) {
  console.log("Database does not exist yet. Start the app to create demo data.");
} else {
  const database = new Database(dbPath);
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='customers'").get();
  if (tables) database.exec("DELETE FROM messages; DELETE FROM conversations; DELETE FROM leads; DELETE FROM customers; DELETE FROM faqs; DELETE FROM products; DELETE FROM automation_rules; DELETE FROM notifications; DELETE FROM settings;");
  database.close();
  console.log("Database cleared. Start the app once to create fresh demo data.");
}
