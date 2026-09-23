import { sql } from "@/lib/db";
import { evaluateAutomation, loadRuleSet } from "@/lib/automation/engine";
import { isWithinBusinessHours, type BusinessHours } from "@/lib/business-hours";
import { createOutboundRecord, ensureCustomer, openConversation, saveInboundMessage } from "@/lib/conversation/service";
import { upsertLead } from "@/lib/lead/service";
import { createNotification } from "@/lib/notification/service";
import { enqueueJob } from "@/lib/jobs/repository";
import { classifyLineError, createLineRetryKey, lineClient } from "./client";
import type { NormalizedLineEvent } from "./events";
import { storeLineMedia } from "@/lib/media/storage";

async function syncProfile(customerId: number, lineUserId: string) {
  const profile = await lineClient.getProfile(lineUserId);
  await sql`UPDATE customers SET display_name=${profile.displayName},picture_url=${profile.pictureUrl ?? null},language=${profile.language ?? null},profile_synced_at=NOW(),updated_at=NOW() WHERE id=${customerId}`;
}

async function tryProfileSync(customerId: number, lineUserId: string, eventId: string) {
  try { await syncProfile(customerId, lineUserId); }
  catch { await enqueueJob("PROFILE_SYNC", `profile:${eventId}`, { customerId, lineUserId }, 5); }
}

async function sendAutomationReply(conversationId: number, event: NormalizedLineEvent, text: string) {
  // LINE does not issue a usable reply token for standby events. Do not create
  // an outbound record that can never be delivered.
  if (event.mode === "standby") return;
  const record = await createOutboundRecord(conversationId, "SYSTEM", text, createLineRetryKey(`reply:${event.eventId}`));
  if (record.delivery_status === "SENT") return;
  await sql`UPDATE messages SET delivery_status='SENDING',attempt_count=attempt_count+1 WHERE id=${record.id}`;
  try {
    if (!event.replyToken) throw new Error("Reply token missing");
    const sent = await lineClient.replyMessage(event.replyToken, [{ type: "text", text }]);
    await sql`UPDATE messages SET delivery_status='SENT',sent_at=NOW(),line_request_id=${sent.requestId},last_error_code=NULL,last_error_message=NULL WHERE id=${record.id}`;
  } catch (error) {
    const lineError = classifyLineError(error);
    await sql`UPDATE messages SET delivery_status='FAILED',failed_at=NOW(),last_error_code=${lineError.code},last_error_message=${lineError.message} WHERE id=${record.id}`;
    if (lineError.retryable) await enqueueJob("OUTBOUND_PUSH", `outbound:${record.id}`, { messageId: record.id }, 8);
    else await createNotification({ type: "DELIVERY", title: "ส่งข้อความไม่สำเร็จ", body: "Automation ส่งข้อความกลับ LINE ไม่สำเร็จ", dedupeKey: `delivery:${record.id}`, conversationId, referenceType: "message", referenceId: String(record.id) });
  }
}

export async function processLineEvent(event: NormalizedLineEvent) {
  const lineUserId = event.source.userId;
  if (!lineUserId) return;
  const followed = event.type === "follow";
  const customer = await ensureCustomer(lineUserId, event.occurredAt, followed);

  if (event.type === "unfollow") {
    await sql`UPDATE customers SET unfollowed_at=${event.occurredAt},updated_at=NOW() WHERE id=${customer.id} AND (unfollowed_at IS NULL OR unfollowed_at<${event.occurredAt}::timestamptz)`;
    return;
  }

  if (!customer.profile_synced_at || followed) await tryProfileSync(customer.id, lineUserId, event.eventId);
  const preview = event.type === "follow" ? "เพิ่มเพื่อน LINE OA" : event.type === "postback" ? `Postback: ${event.postbackData ?? ""}` : event.message?.text ?? event.message?.type ?? event.type;
  const conversation = await openConversation(customer.id, preview, event.occurredAt);

  if (event.type === "follow") {
    const settings = await sql`SELECT welcome_message FROM settings WHERE id=1` as { welcome_message: string }[];
    const welcome = settings[0]?.welcome_message;
    if (welcome) await sendAutomationReply(conversation.id, event, welcome);
    return;
  }

  const inboundId = await saveInboundMessage(conversation.id, event);
  if (!inboundId) return;
  if (conversation.stale) return;

  if (event.message && ["image", "video", "audio", "file"].includes(event.message.type)) {
    await enqueueJob("MEDIA_FETCH", `media:${event.message.id}`, { messageId: inboundId, lineMessageId: event.message.id, messageType: event.message.type }, 5);
  }

  if (conversation.status === "ADMIN" || conversation.status === "WAITING") {
    if (conversation.status === "ADMIN") await createNotification({ type: "ADMIN_MESSAGE", title: "มีข้อความใหม่", body: "ลูกค้าส่งข้อความระหว่างที่ Admin ดูแล", dedupeKey: `admin-message:${event.eventId}`, conversationId: conversation.id, customerId: customer.id, referenceType: "conversation", referenceId: String(conversation.id) });
    return;
  }
  if (event.type !== "message" || event.message?.type !== "text" || !event.message.text) return;

  const rules = await loadRuleSet();
  const decision = await evaluateAutomation(event.message.text, rules);
  const settingRows = await sql`SELECT business_timezone,business_hours,away_message,outside_hours_bot FROM settings WHERE id=1` as { business_timezone: string; business_hours: BusinessHours; away_message: string; outside_hours_bot: boolean }[];
  const settings = settingRows[0];
  const inHours = !settings || isWithinBusinessHours(new Date(event.occurredAt), settings.business_hours, settings.business_timezone);
  let reply = decision.reply;
  let shouldReply = decision.shouldReply;
  let needsAdmin = decision.needsAdmin;
  if (!inHours && (!settings.outside_hours_bot || needsAdmin)) {
    reply = settings.away_message;
    shouldReply = true;
    needsAdmin = true;
  }

  if (decision.shouldCreateLead) {
    const lead = await upsertLead(customer.id, decision.captured, "LINE OA", event.occurredAt);
    if (lead) await createNotification({ type: "LEAD", title: "Lead ใหม่", body: "พบความสนใจซื้อจาก LINE", dedupeKey: `lead:${event.eventId}`, conversationId: conversation.id, customerId: customer.id, leadId: lead.id, referenceType: "lead", referenceId: String(lead.id) });
  }
  if (decision.notifyIntent) await createNotification({ type: "INTENT", title: "พบความตั้งใจซื้อ", body: "ลูกค้ามีข้อความที่ตรงกับ keyword", dedupeKey: `intent:${event.eventId}`, conversationId: conversation.id, customerId: customer.id, referenceType: "conversation", referenceId: String(conversation.id) });
  if (needsAdmin) {
    const type = decision.intent === "HANDOFF" ? "WAITING" : "UNKNOWN";
    await sql`UPDATE conversations SET status='WAITING',bot_paused_at=NOW() WHERE id=${conversation.id} AND status='AUTO' AND (last_event_at IS NULL OR last_event_at<=${event.occurredAt}::timestamptz)`;
    await createNotification({ type, title: "ลูกค้ารอ Admin", body: inHours ? "ต้องการให้เจ้าหน้าที่ช่วยดูแล" : "ลูกค้าติดต่อมานอกเวลาทำการ", dedupeKey: `${type.toLowerCase()}:${event.eventId}`, conversationId: conversation.id, customerId: customer.id, referenceType: "conversation", referenceId: String(conversation.id) });
  }
  if (shouldReply) await sendAutomationReply(conversation.id, event, reply);
}

export async function processOutboundMessage(messageId: number) {
  const claimed = await sql`
    UPDATE messages SET delivery_status='SENDING',attempt_count=attempt_count+1,failed_at=NULL
    WHERE id=${messageId} AND delivery_status IN ('QUEUED','FAILED','SENDING')
    RETURNING id,conversation_id,body,external_id` as { id: number; conversation_id: number; body: string; external_id: string }[];
  if (!claimed.length) return;
  const message = claimed[0];
  const rows = await sql`SELECT c.line_user_id,c.unfollowed_at FROM conversations v JOIN customers c ON c.id=v.customer_id WHERE v.id=${message.conversation_id}` as { line_user_id: string; unfollowed_at: string | null }[];
  const customer = rows[0];
  if (!customer || customer.unfollowed_at) {
    await sql`UPDATE messages SET delivery_status='FAILED',failed_at=NOW(),last_error_code='RECIPIENT_UNAVAILABLE',last_error_message='LINE recipient is unavailable' WHERE id=${messageId}`;
    throw Object.assign(new Error("LINE recipient is unavailable"), { code: "RECIPIENT_UNAVAILABLE", retryable: false });
  }
  // Only the isolated demo customer may simulate delivery. DEMO_MODE and the
  // database demo_mode setting must never bypass LINE for real recipients.
  if (customer.line_user_id === "U_DEMO") {
    await sql`UPDATE messages SET delivery_status='SENT',sent_at=NOW(),last_error_code=NULL,last_error_message=NULL WHERE id=${messageId}`;
    return;
  }
  try {
    const result = await lineClient.pushMessage(customer.line_user_id, [{ type: "text", text: message.body }], message.external_id);
    await sql`UPDATE messages SET delivery_status='SENT',sent_at=NOW(),line_request_id=${result.requestId},last_error_code=NULL,last_error_message=NULL WHERE id=${messageId}`;
    await sql`UPDATE conversations SET last_message=${message.body},last_message_at=NOW() WHERE id=${message.conversation_id}`;
  } catch (error) {
    const lineError = classifyLineError(error);
    await sql`UPDATE messages SET delivery_status='FAILED',failed_at=NOW(),last_error_code=${lineError.code},last_error_message=${lineError.message} WHERE id=${messageId}`;
    throw lineError;
  }
}

export async function processProfileSync(customerId: number, lineUserId: string) { await syncProfile(customerId, lineUserId); }

export async function processMediaFetch(messageId: number, lineMessageId: string, messageType: string) {
  const response = await lineClient.getMessageContent(lineMessageId);
  const stored = await storeLineMedia(lineMessageId, messageType, response);
  if (stored.stored) await sql`UPDATE messages SET media_storage_key=${stored.key},media_url=${`/api/media/${messageId}`},mime_type=${stored.mimeType},file_size=${stored.size},delivery_status='RECEIVED' WHERE id=${messageId}`;
  else await sql`UPDATE messages SET payload=payload || ${JSON.stringify({ storageStatus: stored.reason })}::jsonb,mime_type=${stored.mimeType ?? null} WHERE id=${messageId}`;
}
