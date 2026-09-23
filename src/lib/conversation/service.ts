import { sql } from "@/lib/db";
import { transitionTarget, type ConversationAction } from "./transitions";
import type { ConversationStatus } from "@/lib/types";
import type { NormalizedLineEvent } from "@/lib/line/events";

export async function ensureCustomer(lineUserId: string, stamp: string, followed = false) {
  const rows = await sql`
    INSERT INTO customers(line_user_id,display_name,tags,created_at,updated_at,followed_at,unfollowed_at)
    VALUES(${lineUserId},'ลูกค้า LINE','["ลูกค้าใหม่"]'::jsonb,${stamp},${stamp},${followed ? stamp : null},NULL)
    ON CONFLICT(line_user_id) DO UPDATE SET
      updated_at=GREATEST(customers.updated_at,EXCLUDED.updated_at),
      followed_at=CASE WHEN ${followed} THEN EXCLUDED.followed_at ELSE customers.followed_at END,
      unfollowed_at=CASE WHEN ${followed} THEN NULL ELSE customers.unfollowed_at END
    RETURNING id,display_name,profile_synced_at,unfollowed_at` as { id: number; display_name: string; profile_synced_at: string | null; unfollowed_at: string | null }[];
  return rows[0];
}

export async function openConversation(customerId: number, preview: string, stamp: string) {
  let [conversation] = await sql`SELECT id,status,last_event_at FROM conversations WHERE customer_id=${customerId} AND status!='CLOSED' ORDER BY id DESC LIMIT 1` as { id: number; status: ConversationStatus; last_event_at: string | null }[];
  if (conversation) return { ...conversation, stale: Boolean(conversation.last_event_at && new Date(conversation.last_event_at) > new Date(stamp)) };
  if (!conversation) {
    const [closed] = await sql`SELECT id,status,last_event_at FROM conversations WHERE customer_id=${customerId} ORDER BY id DESC LIMIT 1` as { id: number; status: ConversationStatus; last_event_at: string | null }[];
    if (closed?.last_event_at && new Date(closed.last_event_at) >= new Date(stamp)) return { ...closed, stale: true };
    [conversation] = await sql`
      INSERT INTO conversations(customer_id,status,last_message,last_message_at,created_at,last_event_at)
      VALUES(${customerId},'AUTO',${preview},${stamp},${stamp},${stamp}) RETURNING id,status,last_event_at` as { id: number; status: ConversationStatus; last_event_at: string | null }[];
  }
  return { ...conversation, stale: false };
}

export function inboundBody(event: NormalizedLineEvent) {
  if (event.type === "postback") return `Postback: ${event.postbackData ?? ""}`;
  const message = event.message;
  if (!message) return event.type;
  if (message.type === "text") return message.text ?? "";
  if (message.type === "location") return String(message.metadata.title ?? message.metadata.address ?? "ตำแหน่งที่ตั้ง");
  if (message.type === "sticker") return "สติกเกอร์ LINE";
  const labels: Record<string, string> = { image: "รูปภาพ", video: "วิดีโอ", audio: "เสียง", file: "ไฟล์" };
  return labels[message.type] ?? message.type;
}

export async function saveInboundMessage(conversationId: number, event: NormalizedLineEvent) {
  const body = inboundBody(event);
  const lineMessageId = event.message?.id ?? `postback:${event.eventId}`;
  const rows = await sql`
    INSERT INTO messages(conversation_id,sender,body,created_at,message_type,line_message_id,delivery_status,payload,file_name,file_size)
    VALUES(${conversationId},'CUSTOMER',${body},${event.occurredAt},${event.message?.type ?? "postback"},${lineMessageId},'RECEIVED',${JSON.stringify(event.message?.metadata ?? { postbackData: event.postbackData })}::jsonb,${String(event.message?.metadata.fileName ?? "") || null},${Number(event.message?.metadata.fileSize ?? 0) || null})
    ON CONFLICT(line_message_id) WHERE line_message_id IS NOT NULL DO NOTHING RETURNING id` as { id: number }[];
  if (rows.length) {
    await sql`UPDATE conversations SET last_message=${body},last_message_at=GREATEST(last_message_at,${event.occurredAt}::timestamptz),last_event_at=GREATEST(COALESCE(last_event_at,${event.occurredAt}::timestamptz),${event.occurredAt}::timestamptz) WHERE id=${conversationId}`;
  }
  return rows[0]?.id ?? null;
}

export async function transitionConversation(conversationId: number, action: ConversationAction, actorId = "demo-admin") {
  const currentRows = await sql`SELECT status FROM conversations WHERE id=${conversationId}` as { status: ConversationStatus }[];
  if (!currentRows.length) return { found: false as const };
  const from = currentRows[0].status;
  const to = transitionTarget(from, action);
  const stamp = new Date().toISOString();
  await sql.transaction([
    sql`UPDATE conversations SET status=${to},bot_paused_at=${to === "ADMIN" || to === "WAITING" ? stamp : null},closed_at=${to === "CLOSED" ? stamp : null},last_message_at=${stamp} WHERE id=${conversationId} AND status=${from}`,
    sql`INSERT INTO conversation_events(conversation_id,actor_type,actor_id,action,from_status,to_status,created_at) VALUES(${conversationId},'ADMIN',${actorId},${action},${from},${to},${stamp})`,
    sql`INSERT INTO messages(conversation_id,sender,body,created_at,message_type,delivery_status,internal) VALUES(${conversationId},'SYSTEM',${action === "TAKEOVER" ? "เจ้าหน้าที่รับช่วงการสนทนา" : action === "RESUME" ? "ส่งการสนทนากลับให้ Automation" : "ปิดการสนทนา"},${stamp},'system','SENT',TRUE)`,
  ]);
  return { found: true as const, from, to };
}

export async function createOutboundRecord(conversationId: number, sender: "ADMIN" | "SYSTEM", body: string, externalId: string) {
  const stamp = new Date().toISOString();
  const rows = await sql`
    INSERT INTO messages(conversation_id,sender,body,created_at,message_type,external_id,delivery_status)
    VALUES(${conversationId},${sender},${body},${stamp},'text',${externalId},'QUEUED')
    ON CONFLICT(external_id) WHERE external_id IS NOT NULL DO UPDATE SET external_id=EXCLUDED.external_id
    RETURNING id,delivery_status` as { id: number; delivery_status: string }[];
  return rows[0];
}
