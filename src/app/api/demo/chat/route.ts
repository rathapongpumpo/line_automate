import { NextResponse } from "next/server";
import { z } from "zod";
import { createSmartReply } from "@/lib/automation";
import { db } from "@/lib/db";

const schema = z.object({ message: z.string().trim().min(1).max(500) });
const now = () => new Date().toISOString();

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "กรุณาพิมพ์ข้อความไม่เกิน 500 ตัวอักษร" }, { status: 400 });
  const faqRows = db.prepare("SELECT question,answer,keywords FROM faqs WHERE active=1").all() as Array<{ question: string; answer: string; keywords: string }>;
  const smart = createSmartReply(parsed.data.message, faqRows.map((row) => ({ ...row, keywords: JSON.parse(row.keywords) as string[] })));
  const stamp = now();

  const transaction = db.transaction(() => {
    let customer = db.prepare("SELECT * FROM customers WHERE line_user_id='U_DEMO'").get() as { id: number } | undefined;
    if (!customer) {
      const result = db.prepare("INSERT INTO customers(line_user_id,display_name,name,tags,created_at,updated_at) VALUES('U_DEMO','ลูกค้า Demo','ลูกค้า Demo','[\"ลูกค้าใหม่\"]',?,?)").run(stamp, stamp);
      customer = { id: Number(result.lastInsertRowid) };
    }
    const fields = smart.captured;
    db.prepare(`UPDATE customers SET name=COALESCE(?,name), display_name=COALESCE(?,display_name), phone=COALESCE(?,phone), interested_product=COALESCE(?,interested_product), color=COALESCE(?,color), size=COALESCE(?,size), updated_at=? WHERE id=?`)
      .run(fields.name ?? null, fields.name ?? null, fields.phone ?? null, fields.interestedProduct ?? null, fields.color ?? null, fields.size ?? null, stamp, customer.id);
    let conversation = db.prepare("SELECT id,status FROM conversations WHERE customer_id=? AND status!='CLOSED' ORDER BY id DESC LIMIT 1").get(customer.id) as { id: number; status: string } | undefined;
    if (!conversation) {
      const result = db.prepare("INSERT INTO conversations(customer_id,status,last_message,last_message_at,created_at) VALUES(?,'AUTO',?,?,?)").run(customer.id, parsed.data.message, stamp, stamp);
      conversation = { id: Number(result.lastInsertRowid), status: "AUTO" };
    }
    const status = smart.needsAdmin ? "WAITING" : conversation.status === "ADMIN" ? "ADMIN" : "AUTO";
    db.prepare("INSERT INTO messages(conversation_id,sender,body,created_at) VALUES(?,'CUSTOMER',?,?)").run(conversation.id, parsed.data.message, stamp);
    db.prepare("INSERT INTO messages(conversation_id,sender,body,created_at) VALUES(?,'SYSTEM',?,?)").run(conversation.id, smart.reply, new Date(Date.now() + 500).toISOString());
    db.prepare("UPDATE conversations SET status=?,last_message=?,last_message_at=? WHERE id=?").run(status, parsed.data.message, stamp, conversation.id);
    if (smart.shouldCreateLead) {
      const product = fields.interestedProduct ?? "Oversize Classic";
      db.prepare(`INSERT INTO leads(customer_id,product,phone,status,source,owner,created_at,updated_at) VALUES(?,?,?,'NEW','LINE Demo','ทีมขาย',?,?) ON CONFLICT(customer_id) DO UPDATE SET product=excluded.product,phone=COALESCE(excluded.phone,leads.phone),status=CASE WHEN leads.status IN ('WON','LOST') THEN leads.status ELSE 'INTERESTED' END,updated_at=excluded.updated_at`).run(customer.id, product, fields.phone ?? null, stamp, stamp);
      db.prepare("INSERT INTO notifications(type,title,body,is_read,created_at) VALUES('LEAD','Lead ใหม่','ลูกค้า Demo แสดงความสนใจสินค้า',0,?)").run(stamp);
    }
    if (smart.needsAdmin) db.prepare("INSERT INTO notifications(type,title,body,is_read,created_at) VALUES('WAITING','ลูกค้ารอ Admin','ลูกค้า Demo ต้องการให้เจ้าหน้าที่ช่วยดูแล',0,?)").run(stamp);
    return { conversationId: conversation.id, status };
  });
  const result = transaction();
  return NextResponse.json({ ...result, reply: smart.reply, intent: smart.intent, captured: smart.captured });
}
