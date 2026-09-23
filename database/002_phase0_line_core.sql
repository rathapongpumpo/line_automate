ALTER TABLE customers ADD COLUMN IF NOT EXISTS picture_url TEXT;
--> statement-breakpoint
ALTER TABLE customers ADD COLUMN IF NOT EXISTS language TEXT;
--> statement-breakpoint
ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile_synced_at TIMESTAMPTZ;
--> statement-breakpoint
ALTER TABLE customers ADD COLUMN IF NOT EXISTS followed_at TIMESTAMPTZ;
--> statement-breakpoint
ALTER TABLE customers ADD COLUMN IF NOT EXISTS unfollowed_at TIMESTAMPTZ;
--> statement-breakpoint
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS bot_paused_at TIMESTAMPTZ;
--> statement-breakpoint
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
--> statement-breakpoint
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS conversations_status_last_message_idx ON conversations(status,last_message_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS conversations_customer_last_message_idx ON conversations(customer_id,last_message_at DESC);
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text';
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS line_message_id TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS external_id TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'RECEIVED';
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_storage_key TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS mime_type TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_size BIGINT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS last_error_code TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS last_error_message TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS line_request_id TEXT;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS internal BOOLEAN NOT NULL DEFAULT FALSE;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS messages_line_message_id_uidx ON messages(line_message_id) WHERE line_message_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS messages_external_id_uidx ON messages(external_id) WHERE external_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS messages_delivery_status_idx ON messages(delivery_status,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  source_type TEXT,
  source_user_id TEXT,
  source_group_id TEXT,
  source_room_id TEXT,
  line_timestamp TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(processing_status IN ('PENDING','PROCESSING','PROCESSED','RETRY','FAILED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  is_redelivery BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS webhook_events_retry_idx ON webhook_events(processing_status,next_attempt_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  job_type TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','RETRY','COMPLETED','DEAD')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 8,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS jobs_due_idx ON jobs(status,next_attempt_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS conversation_events (
  id BIGSERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS conversation_events_conversation_idx ON conversation_events(conversation_id,created_at);
--> statement-breakpoint
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_type TEXT;
--> statement-breakpoint
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id TEXT;
--> statement-breakpoint
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key_uidx ON notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN IF NOT EXISTS business_timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok';
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN IF NOT EXISTS business_hours JSONB NOT NULL DEFAULT '{"1":["09:00","18:00"],"2":["09:00","18:00"],"3":["09:00","18:00"],"4":["09:00","18:00"],"5":["09:00","18:00"]}'::jsonb;
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN IF NOT EXISTS away_message TEXT NOT NULL DEFAULT 'ขณะนี้อยู่นอกเวลาทำการ เจ้าหน้าที่จะกลับมาตอบในเวลาทำการถัดไปครับ';
--> statement-breakpoint
ALTER TABLE settings ADD COLUMN IF NOT EXISTS outside_hours_bot BOOLEAN NOT NULL DEFAULT TRUE;
--> statement-breakpoint
UPDATE settings SET channel_secret=NULL, access_token=NULL WHERE channel_secret IS NOT NULL OR access_token IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS login_attempts (
  key_hash TEXT PRIMARY KEY,
  failure_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  actor_id TEXT,
  subject_type TEXT,
  subject_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);
