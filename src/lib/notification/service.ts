import { sql } from "@/lib/db";

export async function createNotification(input: {
  type: string;
  title: string;
  body: string;
  dedupeKey: string;
  conversationId?: number;
  customerId?: number;
  leadId?: number;
  referenceType?: string;
  referenceId?: string;
}) {
  const stamp = new Date().toISOString();
  const rows = await sql`
    INSERT INTO notifications(type,title,body,is_read,created_at,conversation_id,customer_id,lead_id,reference_type,reference_id,dedupe_key)
    VALUES(${input.type},${input.title},${input.body},FALSE,${stamp},${input.conversationId ?? null},${input.customerId ?? null},${input.leadId ?? null},${input.referenceType ?? null},${input.referenceId ?? null},${input.dedupeKey})
    ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING id`;
  return rows[0] ? Number((rows[0] as { id: number }).id) : null;
}
