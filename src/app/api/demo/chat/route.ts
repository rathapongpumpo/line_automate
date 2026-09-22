import { NextResponse } from "next/server";
import { z } from "zod";
import { createSmartReply } from "@/lib/automation";
import { sql } from "@/lib/db";

const schema = z.object({ message: z.string().trim().min(1).max(500) });
const now = () => new Date().toISOString();

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "กรุณาพิมพ์ข้อความไม่เกิน 500 ตัวอักษร" }, { status: 400 });

  const faqRows = await sql`SELECT question,answer,keywords FROM faqs WHERE active=TRUE` as { question: string; answer: string; keywords: unknown }[];
  const smart = createSmartReply(parsed.data.message, faqRows.map((row) => ({
    question: row.question,
    answer: row.answer,
    keywords: Array.isArray(row.keywords) ? row.keywords.map(String) : [],
  })));
  const stamp = now();
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

  const status = smart.needsAdmin ? "WAITING" : conversation.status === "ADMIN" ? "ADMIN" : "AUTO";
  await sql.transaction([
    sql`INSERT INTO messages(conversation_id,sender,body,created_at) VALUES(${conversation.id},'CUSTOMER',${parsed.data.message},${stamp})`,
    sql`INSERT INTO messages(conversation_id,sender,body,created_at) VALUES(${conversation.id},'SYSTEM',${smart.reply},${new Date(Date.now() + 500).toISOString()})`,
    sql`UPDATE conversations SET status=${status},last_message=${parsed.data.message},last_message_at=${stamp} WHERE id=${conversation.id}`,
  ]);

  if (smart.shouldCreateLead) {
    const product = fields.interestedProduct ?? "Oversize Classic";
    await sql.transaction([
      sql`INSERT INTO leads(customer_id,product,phone,status,source,owner,created_at,updated_at)
          VALUES(${customer.id},${product},${fields.phone ?? null},'NEW','LINE Demo','ทีมขาย',${stamp},${stamp})
          ON CONFLICT(customer_id) DO UPDATE SET product=EXCLUDED.product,phone=COALESCE(EXCLUDED.phone,leads.phone),status=CASE WHEN leads.status IN ('WON','LOST') THEN leads.status ELSE 'INTERESTED' END,updated_at=EXCLUDED.updated_at`,
      sql`INSERT INTO notifications(type,title,body,is_read,created_at) VALUES('LEAD','Lead ใหม่','ลูกค้า Demo แสดงความสนใจสินค้า',FALSE,${stamp})`,
    ]);
  }
  if (smart.needsAdmin) {
    await sql`INSERT INTO notifications(type,title,body,is_read,created_at) VALUES('WAITING','ลูกค้ารอ Admin','ลูกค้า Demo ต้องการให้เจ้าหน้าที่ช่วยดูแล',FALSE,${stamp})`;
  }

  return NextResponse.json({ conversationId: conversation.id, status, reply: smart.reply, intent: smart.intent, captured: smart.captured });
}
