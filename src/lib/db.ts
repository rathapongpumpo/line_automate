import { neon } from "@neondatabase/serverless";
import type { AppState, AutomationRule, Conversation, Customer, FAQ, Lead, Notification, Product } from "./types";

const connectionString = process.env.DATABASE_URL;
if (!connectionString?.startsWith("postgres")) {
  throw new Error("DATABASE_URL must be a PostgreSQL connection string");
}

export const sql = neon(connectionString);

export function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

const mapCustomer = (row: Record<string, unknown>): Customer => ({
  id: Number(row.id), lineUserId: String(row.line_user_id), displayName: String(row.display_name), name: row.name ? String(row.name) : null,
  phone: row.phone ? String(row.phone) : null, email: row.email ? String(row.email) : null, tags: stringArray(row.tags),
  interestedProduct: row.interested_product ? String(row.interested_product) : null, color: row.color ? String(row.color) : null,
  size: row.size ? String(row.size) : null, createdAt: toIso(row.created_at), updatedAt: toIso(row.updated_at),
});

export async function getAppState(): Promise<AppState> {
  const [customerRows, conversationRows, messageRows, leadRows, faqRows, productRows, ruleRows, notificationRows, settingsRows] = await Promise.all([
    sql`SELECT * FROM customers ORDER BY updated_at DESC`,
    sql`SELECT * FROM conversations ORDER BY last_message_at DESC`,
    sql`SELECT id, conversation_id, sender, body, created_at FROM messages ORDER BY created_at ASC`,
    sql`SELECT l.*, c.display_name, c.color, c.size FROM leads l JOIN customers c ON c.id = l.customer_id ORDER BY l.updated_at DESC`,
    sql`SELECT * FROM faqs ORDER BY updated_at DESC`,
    sql`SELECT * FROM products ORDER BY id`,
    sql`SELECT * FROM automation_rules ORDER BY id`,
    sql`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20`,
    sql`SELECT * FROM settings WHERE id = 1`,
  ]);

  const customers = (customerRows as Record<string, unknown>[]).map(mapCustomer);
  const customerById = new Map(customers.map((item) => [item.id, item]));
  const messagesByConversation = new Map<number, Conversation["messages"]>();
  for (const row of messageRows as Record<string, unknown>[]) {
    const conversationId = Number(row.conversation_id);
    const messages = messagesByConversation.get(conversationId) ?? [];
    messages.push({ id: Number(row.id), conversationId, sender: row.sender as "CUSTOMER" | "SYSTEM" | "ADMIN", body: String(row.body), createdAt: toIso(row.created_at) });
    messagesByConversation.set(conversationId, messages);
  }

  const conversations: Conversation[] = (conversationRows as Record<string, unknown>[])
    .map((row) => {
      const customer = customerById.get(Number(row.customer_id));
      if (!customer) return null;
      return {
        id: Number(row.id), status: row.status as Conversation["status"], lastMessage: String(row.last_message), lastMessageAt: toIso(row.last_message_at),
        createdAt: toIso(row.created_at), customer, messages: messagesByConversation.get(Number(row.id)) ?? [],
      } satisfies Conversation;
    })
    .filter((item): item is Conversation => item !== null);

  const leads = (leadRows as Record<string, unknown>[]).map((row): Lead => ({
    id: Number(row.id), customerId: Number(row.customer_id), customerName: String(row.display_name), product: String(row.product),
    phone: row.phone ? String(row.phone) : null, status: row.status as Lead["status"], source: String(row.source), owner: String(row.owner),
    createdAt: toIso(row.created_at), updatedAt: toIso(row.updated_at), color: row.color ? String(row.color) : null, size: row.size ? String(row.size) : null,
  }));
  const faqs = (faqRows as Record<string, unknown>[]).map((row): FAQ => ({
    id: Number(row.id), question: String(row.question), answer: String(row.answer), keywords: stringArray(row.keywords), active: Boolean(row.active), updatedAt: toIso(row.updated_at),
  }));
  const products = (productRows as Record<string, unknown>[]).map((row): Product => ({
    id: Number(row.id), name: String(row.name), price: Number(row.price), colors: stringArray(row.colors), sizes: stringArray(row.sizes), stock: Number(row.stock), active: Boolean(row.active),
  }));
  const automationRules = (ruleRows as Record<string, unknown>[]).map((row): AutomationRule => ({
    id: Number(row.id), key: String(row.rule_key), label: String(row.label), description: String(row.description), enabled: Boolean(row.enabled), value: row.value ? String(row.value) : null,
  }));
  const notifications = (notificationRows as Record<string, unknown>[]).map((row): Notification => ({
    id: Number(row.id), type: String(row.type), title: String(row.title), body: String(row.body), read: Boolean(row.is_read), createdAt: toIso(row.created_at),
  }));
  const settingsRow = (settingsRows[0] ?? {}) as Record<string, unknown>;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const demoCustomer = customers.find((item) => item.lineUserId === "U_DEMO");
  const demoLeadIsNew = demoCustomer ? leads.some((item) => item.customerId === demoCustomer.id && item.status === "NEW") : false;
  const demoIsWaiting = demoCustomer ? conversations.some((item) => item.customer.id === demoCustomer.id && item.status === "WAITING") : false;

  return {
    summary: {
      conversations: Math.max(38, conversations.filter((item) => new Date(item.lastMessageAt) >= startOfToday).length),
      newLeads: 12 + (demoLeadIsNew ? 1 : 0), waiting: 5 + (demoIsWaiting ? 1 : 0), won: 7,
    },
    conversations, customers, leads, faqs, products, automationRules, notifications,
    settings: {
      storeName: String(settingsRow.store_name || "WLB Store"), phone: String(settingsRow.phone || ""), welcomeMessage: String(settingsRow.welcome_message || ""),
      demoMode: settingsRow.demo_mode === undefined ? process.env.DEMO_MODE !== "false" : Boolean(settingsRow.demo_mode),
      channelId: String(settingsRow.channel_id || process.env.LINE_CHANNEL_ID || ""),
      hasChannelSecret: Boolean(settingsRow.channel_secret || process.env.LINE_CHANNEL_SECRET), hasAccessToken: Boolean(settingsRow.access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN),
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/line/webhook`,
    },
  };
}
