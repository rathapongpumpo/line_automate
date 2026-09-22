import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const conversationId = Number(id);
  if (!Number.isInteger(conversationId)) return NextResponse.json({ error: "Conversation ไม่ถูกต้อง" }, { status: 400 });
  const stamp = new Date().toISOString();
  const result = db.prepare("UPDATE conversations SET status='ADMIN',last_message_at=? WHERE id=?").run(stamp, conversationId);
  if (!result.changes) return NextResponse.json({ error: "ไม่พบการสนทนา" }, { status: 404 });
  db.prepare("INSERT INTO messages(conversation_id,sender,body,created_at) VALUES(?,'ADMIN','เจ้าหน้าที่รับช่วงการสนทนาแล้วครับ',?)").run(conversationId, stamp);
  return NextResponse.json({ ok: true });
}
