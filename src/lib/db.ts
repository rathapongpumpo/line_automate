import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { AppState, AutomationRule, Conversation, Customer, FAQ, Lead, Notification, Product } from "./types";

const databasePath = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.DATABASE_URL?.replace(/^file:/, "") || "./data/line-sales-assistant.sqlite");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const globalForDb = globalThis as unknown as { lineAssistantDb?: Database.Database };
export const db = globalForDb.lineAssistantDb ?? new Database(databasePath);
if (process.env.NODE_ENV !== "production") globalForDb.lineAssistantDb = db;

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_user_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  interested_product TEXT,
  color TEXT,
  size TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('AUTO','ADMIN','WAITING','CLOSED')),
  last_message TEXT NOT NULL,
  last_message_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK(sender IN ('CUSTOMER','SYSTEM','ADMIN')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL CHECK(status IN ('NEW','CONTACTED','INTERESTED','WON','LOST')),
  source TEXT NOT NULL,
  owner TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS leads_customer_unique ON leads(customer_id);
CREATE TABLE IF NOT EXISTS faqs (id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT NOT NULL, answer TEXT NOT NULL, keywords TEXT NOT NULL DEFAULT '[]', active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price INTEGER NOT NULL, colors TEXT NOT NULL, sizes TEXT NOT NULL, stock INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS automation_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, rule_key TEXT NOT NULL UNIQUE, label TEXT NOT NULL, description TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, value TEXT);
CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id = 1), store_name TEXT NOT NULL, phone TEXT NOT NULL, welcome_message TEXT NOT NULL, demo_mode INTEGER NOT NULL DEFAULT 1, channel_id TEXT, channel_secret TEXT, access_token TEXT);
CREATE TABLE IF NOT EXISTS processed_webhooks (event_id TEXT PRIMARY KEY, processed_at TEXT NOT NULL);
`);

function iso(minutesAgo = 0) { return new Date(Date.now() - minutesAgo * 60_000).toISOString(); }

export function seedDatabase(force = false) {
  const count = (db.prepare("SELECT COUNT(*) AS count FROM customers").get() as { count: number }).count;
  if (count && !force) return;
  if (force) {
    db.exec("DELETE FROM messages; DELETE FROM conversations; DELETE FROM leads; DELETE FROM customers; DELETE FROM faqs; DELETE FROM products; DELETE FROM automation_rules; DELETE FROM notifications; DELETE FROM settings;");
  }
  const customerSeed = [
    ["U001", "สมชาย", "สมชาย", "0892345678", "somchai@example.com", ["ลูกค้าใหม่", "สนใจสินค้า"], "Oversize Classic", "Black", "XL"],
    ["U002", "เมย์", "เมย์", "0817284102", null, ["VIP"], "Everyday Tee", "White", "M"],
    ["U003", "นนท์", "นนท์", "0946282011", null, ["ต้อง Follow-up"], "Oversize Classic", "Charcoal", "L"],
    ["U004", "พลอย", "พลอย", "0869012488", "ploy@example.com", ["สนใจสินค้า"], "Minimal Polo", "White", "M"],
    ["U005", "กิตติ", "กิตติ", "0991028374", null, ["ลูกค้าใหม่"], "Oversize Classic", "Black", "2XL"],
    ["U006", "แอน", "แอน", "0836642109", null, ["VIP"], "Everyday Tee", "Black", "L"],
    ["U007", "วรรณ", "วรรณ", "0957261900", null, ["ต้อง Follow-up"], "Minimal Polo", "Charcoal", "XL"],
    ["U008", "ธนา", "ธนา", "0828881054", null, ["ลูกค้าใหม่"], "Oversize Classic", "White", "M"],
    ["U009", "อร", "อร", "0871123904", null, ["สนใจสินค้า"], "Everyday Tee", "White", "L"],
    ["U010", "ภพ", "ภพ", "0804412857", null, ["ลูกค้าใหม่"], "Oversize Classic", "Black", "XL"],
  ];
  const addCustomer = db.prepare("INSERT INTO customers(line_user_id,display_name,name,phone,email,tags,interested_product,color,size,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
  customerSeed.forEach((c, index) => addCustomer.run(c[0], c[1], c[2], c[3], c[4], JSON.stringify(c[5]), c[6], c[7], c[8], iso(12000 + index * 400), iso(index * 17)));

  const conversationSeed = [
    [1, "AUTO", "มีสีดำ XL ไหมครับ", 2], [2, "WAITING", "ขอคุยกับเจ้าหน้าที่ค่ะ", 8], [3, "ADMIN", "ขอบคุณครับ", 16], [4, "CLOSED", "ได้รับสินค้าแล้วค่ะ", 80],
    [5, "AUTO", "ราคาเท่าไหร่ครับ", 120], [6, "AUTO", "ส่งของกี่วันคะ", 180], [7, "WAITING", "มีใบกำกับภาษีไหมคะ", 220], [8, "CLOSED", "โอเคครับ", 390],
    [9, "ADMIN", "สนใจสีขาว L ค่ะ", 520], [10, "AUTO", "มีเก็บเงินปลายทางไหมครับ", 700], [2, "CLOSED", "เปลี่ยนไซซ์เรียบร้อยค่ะ", 900], [3, "AUTO", "มีโปรอะไรบ้าง", 1100],
    [4, "CLOSED", "ขอบคุณค่ะ", 1500], [5, "ADMIN", "เบอร์ 0991028374 ครับ", 1800], [6, "CLOSED", "สั่งซื้อแล้วค่ะ", 2100], [8, "AUTO", "ไซซ์ M ยังมีไหมครับ", 2400],
  ];
  const addConversation = db.prepare("INSERT INTO conversations(customer_id,status,last_message,last_message_at,created_at) VALUES(?,?,?,?,?)");
  const addMessage = db.prepare("INSERT INTO messages(conversation_id,sender,body,created_at) VALUES(?,?,?,?)");
  conversationSeed.forEach((c) => {
    const result = addConversation.run(c[0], c[1], c[2], iso(c[3] as number), iso((c[3] as number) + 30));
    const id = Number(result.lastInsertRowid);
    addMessage.run(id, "CUSTOMER", c[2], iso(c[3] as number));
    if (c[1] !== "WAITING") addMessage.run(id, c[1] === "ADMIN" ? "ADMIN" : "SYSTEM", c[1] === "ADMIN" ? "รับช่วงดูแลให้แล้วครับ" : "ยินดีช่วยดูแลครับ สอบถามเพิ่มเติมได้เลย", iso((c[3] as number) - 1));
  });

  const addLead = db.prepare("INSERT INTO leads(customer_id,product,phone,status,source,owner,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)");
  const leadStatuses = ["INTERESTED", "NEW", "CONTACTED", "WON", "NEW", "WON", "LOST", "CONTACTED", "INTERESTED", "NEW"];
  customerSeed.forEach((c, index) => addLead.run(index + 1, c[6], c[3], leadStatuses[index], "LINE OA", index % 3 === 0 ? "ณิชา" : "ทีมขาย", iso(index * 240 + 20), iso(index * 90)));

  const faqSeed = [
    ["ส่งของกี่วัน", "กรุงเทพฯ 1–2 วัน ต่างจังหวัด 2–3 วันครับ", ["ส่ง", "จัดส่ง", "กี่วัน"]],
    ["มีเก็บเงินปลายทางไหม", "มีบริการเก็บเงินปลายทางครับ", ["COD", "เก็บเงินปลายทาง"]],
    ["เปลี่ยนไซซ์ได้ไหม", "สามารถเปลี่ยนไซซ์ภายใน 7 วัน สินค้าต้องอยู่ในสภาพเดิมครับ", ["เปลี่ยนไซซ์", "เปลี่ยนขนาด"]],
    ["ค่าจัดส่งเท่าไหร่", "ค่าจัดส่ง 50 บาท ซื้อครบ 1,500 บาทส่งฟรีครับ", ["ค่าส่ง", "ค่าจัดส่ง"]],
    ["ชำระเงินช่องทางไหนได้บ้าง", "ชำระผ่านโอนธนาคารและพร้อมเพย์ได้ครับ", ["ชำระ", "โอน", "พร้อมเพย์"]],
    ["มีหน้าร้านไหม", "WLB Store จำหน่ายออนไลน์ผ่าน LINE OA เป็นหลักครับ", ["หน้าร้าน", "ที่ร้าน"]],
    ["ขอใบเสร็จได้ไหม", "ออกใบเสร็จรับเงินได้ กรุณาแจ้งชื่อและที่อยู่กับเจ้าหน้าที่ครับ", ["ใบเสร็จ"]],
    ["ติดตามพัสดุอย่างไร", "หลังจัดส่ง ระบบจะแจ้งเลขติดตามพัสดุผ่าน LINE ครับ", ["ติดตาม", "เลขพัสดุ"]],
  ];
  const addFaq = db.prepare("INSERT INTO faqs(question,answer,keywords,active,updated_at) VALUES(?,?,?,?,?)");
  faqSeed.forEach((f, index) => addFaq.run(f[0], f[1], JSON.stringify(f[2]), 1, iso(index * 200)));

  const addProduct = db.prepare("INSERT INTO products(name,price,colors,sizes,stock,active) VALUES(?,?,?,?,?,1)");
  addProduct.run("Oversize Classic", 690, JSON.stringify(["Black", "White", "Charcoal"]), JSON.stringify(["M", "L", "XL", "2XL"]), 84);
  addProduct.run("Everyday Tee", 490, JSON.stringify(["Black", "White"]), JSON.stringify(["S", "M", "L", "XL"]), 61);
  addProduct.run("Minimal Polo", 790, JSON.stringify(["White", "Charcoal"]), JSON.stringify(["M", "L", "XL"]), 37);

  const addRule = db.prepare("INSERT INTO automation_rules(rule_key,label,description,enabled,value) VALUES(?,?,?,?,?)");
  addRule.run("auto_faq", "ตอบ FAQ อัตโนมัติ", "ค้นหาคำตอบจากคำถามที่พบบ่อย", 1, null);
  addRule.run("auto_lead", "เก็บ Lead อัตโนมัติ", "สร้าง Lead เมื่อพบความสนใจหรือข้อมูลติดต่อ", 1, null);
  addRule.run("notify_unknown", "แจ้ง Admin เมื่อระบบตอบไม่ได้", "เปลี่ยนสถานะเป็น WAITING และสร้างการแจ้งเตือน", 1, null);
  addRule.run("notify_intent", "แจ้งเมื่อมีความตั้งใจซื้อ", "ตรวจคำว่า ซื้อ, สั่ง, สนใจ, ขอราคา", 1, "ซื้อ,สั่ง,สนใจ,ขอราคา");

  const addNotification = db.prepare("INSERT INTO notifications(type,title,body,is_read,created_at) VALUES(?,?,?,?,?)");
  [["WAITING","ลูกค้ารอ Admin","เมย์ขอคุยกับเจ้าหน้าที่",0,5],["LEAD","Lead ใหม่","สมชายสนใจ Oversize Classic",0,12],["UNKNOWN","ระบบตอบไม่ได้","วรรณสอบถามใบกำกับภาษี",0,30],["INTENT","พบความตั้งใจซื้อ","อรสนใจสีขาว L",1,90],["LEAD","Lead ใหม่","กิตติแจ้งเบอร์ติดต่อ",1,150]].forEach((n) => addNotification.run(n[0],n[1],n[2],n[3],iso(n[4] as number)));
  db.prepare("INSERT INTO settings(id,store_name,phone,welcome_message,demo_mode,channel_id,channel_secret,access_token) VALUES(1,?,?,?,?,?,?,?)").run("WLB Store", "02-123-4567", "สวัสดีครับ 👋\nยินดีต้อนรับสู่ WLB Store\nสอบถามสินค้า ราคา ไซซ์ หรือการจัดส่งได้เลยครับ", process.env.DEMO_MODE === "false" ? 0 : 1, process.env.LINE_CHANNEL_ID ?? "", process.env.LINE_CHANNEL_SECRET ?? "", process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "");
}

seedDatabase();

const parse = <T>(value: string): T => JSON.parse(value) as T;
const mapCustomer = (row: Record<string, unknown>): Customer => ({
  id: Number(row.id), lineUserId: String(row.line_user_id), displayName: String(row.display_name), name: row.name ? String(row.name) : null,
  phone: row.phone ? String(row.phone) : null, email: row.email ? String(row.email) : null, tags: parse<string[]>(String(row.tags)),
  interestedProduct: row.interested_product ? String(row.interested_product) : null, color: row.color ? String(row.color) : null,
  size: row.size ? String(row.size) : null, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});

export function getAppState(): AppState {
  const customerRows = db.prepare("SELECT * FROM customers ORDER BY updated_at DESC").all() as Record<string, unknown>[];
  const customers = customerRows.map(mapCustomer);
  const customerById = new Map(customers.map((item) => [item.id, item]));
  const conversationRows = db.prepare("SELECT * FROM conversations ORDER BY last_message_at DESC").all() as Record<string, unknown>[];
  const getMessages = db.prepare("SELECT id,conversation_id,sender,body,created_at FROM messages WHERE conversation_id=? ORDER BY created_at ASC");
  const conversations: Conversation[] = conversationRows.map((row) => ({
    id: Number(row.id), status: row.status as Conversation["status"], lastMessage: String(row.last_message), lastMessageAt: String(row.last_message_at), createdAt: String(row.created_at),
    customer: customerById.get(Number(row.customer_id))!,
    messages: (getMessages.all(row.id) as Record<string, unknown>[]).map((message) => ({ id: Number(message.id), conversationId: Number(message.conversation_id), sender: message.sender as "CUSTOMER" | "SYSTEM" | "ADMIN", body: String(message.body), createdAt: String(message.created_at) })),
  }));
  const leads = (db.prepare("SELECT l.*, c.display_name, c.color, c.size FROM leads l JOIN customers c ON c.id=l.customer_id ORDER BY l.updated_at DESC").all() as Record<string, unknown>[]).map((row): Lead => ({
    id: Number(row.id), customerId: Number(row.customer_id), customerName: String(row.display_name), product: String(row.product), phone: row.phone ? String(row.phone) : null,
    status: row.status as Lead["status"], source: String(row.source), owner: String(row.owner), createdAt: String(row.created_at), updatedAt: String(row.updated_at), color: row.color ? String(row.color) : null, size: row.size ? String(row.size) : null,
  }));
  const faqs = (db.prepare("SELECT * FROM faqs ORDER BY updated_at DESC").all() as Record<string, unknown>[]).map((row): FAQ => ({ id: Number(row.id), question: String(row.question), answer: String(row.answer), keywords: parse<string[]>(String(row.keywords)), active: Boolean(row.active), updatedAt: String(row.updated_at) }));
  const products = (db.prepare("SELECT * FROM products ORDER BY id").all() as Record<string, unknown>[]).map((row): Product => ({ id: Number(row.id), name: String(row.name), price: Number(row.price), colors: parse<string[]>(String(row.colors)), sizes: parse<string[]>(String(row.sizes)), stock: Number(row.stock), active: Boolean(row.active) }));
  const automationRules = (db.prepare("SELECT * FROM automation_rules ORDER BY id").all() as Record<string, unknown>[]).map((row): AutomationRule => ({ id: Number(row.id), key: String(row.rule_key), label: String(row.label), description: String(row.description), enabled: Boolean(row.enabled), value: row.value ? String(row.value) : null }));
  const notifications = (db.prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20").all() as Record<string, unknown>[]).map((row): Notification => ({ id: Number(row.id), type: String(row.type), title: String(row.title), body: String(row.body), read: Boolean(row.is_read), createdAt: String(row.created_at) }));
  const settingsRow = db.prepare("SELECT * FROM settings WHERE id=1").get() as Record<string, unknown>;
  const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
  const demoCustomer = customers.find((item) => item.lineUserId === "U_DEMO");
  const demoLeadIsNew = demoCustomer ? leads.some((item) => item.customerId === demoCustomer.id && item.status === "NEW") : false;
  const demoIsWaiting = demoCustomer ? conversations.some((item) => item.customer.id === demoCustomer.id && item.status === "WAITING") : false;
  return {
    summary: {
      conversations: Math.max(38, conversations.filter((item) => new Date(item.lastMessageAt) >= startOfToday).length),
      newLeads: 12 + (demoLeadIsNew ? 1 : 0),
      waiting: 5 + (demoIsWaiting ? 1 : 0),
      won: 7,
    }, conversations, customers, leads, faqs, products, automationRules, notifications,
    settings: {
      storeName: String(settingsRow.store_name), phone: String(settingsRow.phone), welcomeMessage: String(settingsRow.welcome_message), demoMode: Boolean(settingsRow.demo_mode),
      channelId: String(settingsRow.channel_id || process.env.LINE_CHANNEL_ID || ""), hasChannelSecret: Boolean(settingsRow.channel_secret || process.env.LINE_CHANNEL_SECRET), hasAccessToken: Boolean(settingsRow.access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN),
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/line/webhook`,
    },
  };
}
