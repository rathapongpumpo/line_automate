import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const conversationId = Number(id);
  if (!Number.isInteger(conversationId)) return NextResponse.json({ error: "Conversation ไม่ถูกต้อง" }, { status: 400 });
  const stamp = new Date().toISOString();
  const rows = await sql`UPDATE conversations SET status='ADMIN',last_message_at=${stamp} WHERE id=${conversationId} RETURNING id`;
  if (!rows.length) return NextResponse.json({ error: "ไม่พบการสนทนา" }, { status: 404 });
  await sql`INSERT INTO messages(conversation_id,sender,body,created_at) VALUES(${conversationId},'ADMIN','เจ้าหน้าที่รับช่วงการสนทนาแล้วครับ',${stamp})`;
  return NextResponse.json({ ok: true });
}
