import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateAutomation, loadRuleSet } from "@/lib/automation/engine";
import { sql } from "@/lib/db";

const schema = z.object({ message: z.string().trim().min(1).max(500), idempotencyKey: z.uuid() });
const now = () => new Date().toISOString();

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "กรุณาพิมพ์ข้อความไม่เกิน 500 ตัวอักษร" }, { status: 400 });

  const smart = await evaluateAutomation(parsed.data.message, await loadRuleSet());
  const stamp = now();
  const inboundKey = `demo:${parsed.data.idempotencyKey}`;
  const existing = await sql`SELECT conversation_id FROM messages WHERE line_message_id=${inboundKey}` as { conversation_id: number }[];
  if (existing.length) return NextResponse.json({ conversationId: existing[0].conversation_id, duplicate: true, reply: null });
  const fields = smart.captured;

  const [customer] = await sql`
    INSERT INTO customers(line_user_id,display_name,name,phone,tags,interested_product,color,size,created_at,updated_at)
    VALUES('U_DEMO','ลูกค้า Demo',COALESCE(${fields.name ?? null},'ลูกค้า Demo'),${fields.phone ?? null},'["ลูกค้าใหม่"]'::jsonb,${fields.interestedProduct ?? null},${fields.color ?? null},${fields.size ?? null},${stamp},${stamp})
    ON CONFLICT(line_user_id) DO UPDATE SET
      name=COALESCE(${fields.name ?? null},customers.name),
      display_name=COALESCE(${fields.name ?? null},customers.display_name),
      phone=COALESCE(EXCLUDED.phone,customers.phone),
      interested_product=COALESCE(EXCLUDED.interested_product,customers.interested_product),
      color=COALESCE(EXCLUDED.color,customers.color),
      size=COALESCE(EXCLUDED.size,customers.size),
      updated_at=EXCLUDED.updated_at
    RETURNING id` as { id: number }[];

  let [conversation] = await sql`
    SELECT id,status FROM conversations WHERE customer_id=${customer.id} AND status!='CLOSED' ORDER BY id DESC LIMIT 1` as { id: number; status: string }[];
  if (!conversation) {
    [conversation] = await sql`
      INSERT INTO conversations(customer_id,status,last_message,last_message_at,created_at)
      VALUES(${customer.id},'AUTO',${parsed.data.message},${stamp},${stamp}) RETURNING id,status` as { id: number; status: string }[];
  }

  const suppressed = conversation.status === "ADMIN" || conversation.status === "WAITING";
  const status = suppressed ? conversation.status : smart.needsAdmin ? "WAITING" : "AUTO";
  const inserted = await sql`INSERT INTO messages(conversation_id,sender,body,created_at,message_type,line_message_id,delivery_status) VALUES(${conversation.id},'CUSTOMER',${parsed.data.message},${stamp},'text',${inboundKey},'RECEIVED') ON CONFLICT(line_message_id) WHERE line_message_id IS NOT NULL DO NOTHING RETURNING id`;
  if (!inserted.length) return NextResponse.json({ conversationId: conversation.id, duplicate: true, reply: null });
  const statements = [sql`UPDATE conversations SET status=${status},last_message=${parsed.data.message},last_message_at=${stamp} WHERE id=${conversation.id}`];
  if (!suppressed && smart.shouldReply) statements.push(sql`INSERT INTO messages(conversation_id,sender,body,created_at,message_type,external_id,delivery_status,sent_at) VALUES(${conversation.id},'SYSTEM',${smart.reply},${new Date(Date.now() + 500).toISOString()},'text',${`demo-reply:${parsed.data.idempotencyKey}`},'SENT',NOW()) ON CONFLICT(external_id) WHERE external_id IS NOT NULL DO NOTHING`);
  await sql.transaction(statements);

  if (smart.shouldCreateLead) {
    const product = fields.interestedProduct ?? "Oversize Classic";
    await sql.transaction([
      sql`INSERT INTO leads(customer_id,product,phone,status,source,owner,created_at,updated_at)
          VALUES(${customer.id},${product},${fields.phone ?? null},'NEW','LINE Demo','ทีมขาย',${stamp},${stamp})
          ON CONFLICT(customer_id) DO UPDATE SET product=EXCLUDED.product,phone=COALESCE(EXCLUDED.phone,leads.phone),status=CASE WHEN leads.status IN ('WON','LOST') THEN leads.status ELSE 'INTERESTED' END,updated_at=EXCLUDED.updated_at`,
      sql`INSERT INTO notifications(type,title,body,is_read,created_at,conversation_id,customer_id,dedupe_key) VALUES('LEAD','Lead ใหม่','ลูกค้า Demo แสดงความสนใจสินค้า',FALSE,${stamp},${conversation.id},${customer.id},${`demo-lead:${stamp}`}) ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
    ]);
  }
  if (!suppressed && smart.needsAdmin) {
    await sql`INSERT INTO notifications(type,title,body,is_read,created_at,conversation_id,customer_id,dedupe_key) VALUES('WAITING','ลูกค้ารอ Admin','ลูกค้า Demo ต้องการให้เจ้าหน้าที่ช่วยดูแล',FALSE,${stamp},${conversation.id},${customer.id},${`demo-waiting:${stamp}`}) ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`;
  }
  if (!suppressed && smart.notifyIntent) await sql`INSERT INTO notifications(type,title,body,is_read,created_at,conversation_id,customer_id,dedupe_key) VALUES('INTENT','พบความตั้งใจซื้อ','ลูกค้า Demo ตรงกับ keyword',FALSE,${stamp},${conversation.id},${customer.id},${`demo-intent:${parsed.data.idempotencyKey}`}) ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`;

  return NextResponse.json({ conversationId: conversation.id, status, reply: suppressed || !smart.shouldReply ? null : smart.reply, intent: smart.intent, captured: smart.captured });
}
