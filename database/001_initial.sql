CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  line_user_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  interested_product TEXT,
  color TEXT,
  size TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('AUTO','ADMIN','WAITING','CLOSED')),
  last_message TEXT NOT NULL,
  last_message_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS conversations_customer_status_idx ON conversations(customer_id,status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS conversations_last_message_idx ON conversations(last_message_at DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK(sender IN ('CUSTOMER','SYSTEM','ADMIN')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON messages(conversation_id,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL CHECK(status IN ('NEW','CONTACTED','INTERESTED','WON','LOST')),
  source TEXT NOT NULL,
  owner TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(customer_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS faqs (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK(price >= 0),
  colors JSONB NOT NULL DEFAULT '[]'::jsonb,
  sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS automation_rules (
  id SERIAL PRIMARY KEY,
  rule_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  value TEXT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  store_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  welcome_message TEXT NOT NULL,
  demo_mode BOOLEAN NOT NULL DEFAULT TRUE,
  channel_id TEXT,
  channel_secret TEXT,
  access_token TEXT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS processed_webhooks (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL
);
