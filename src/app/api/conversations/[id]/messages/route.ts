import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({ message: z.string().trim().min(1).max(500) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const { id } = await context.params;
  if (!parsed.success) return NextResponse.json({ error: "กรุณาพิมพ์ข้อความ" }, { status: 400 });
  const conversationId = Number(id);
  const stamp = new Date().toISOString();
  if (!db.prepare("SELECT id FROM conversations WHERE id=?").get(conversationId)) return NextResponse.json({ error: "ไม่พบการสนทนา" }, { status: 404 });
  db.prepare("INSERT INTO messages(conversation_id,sender,body,created_at) VALUES(?,'ADMIN',?,?)").run(conversationId, parsed.data.message, stamp);
  db.prepare("UPDATE conversations SET status='ADMIN',last_message=?,last_message_at=? WHERE id=?").run(parsed.data.message, stamp, conversationId);
  return NextResponse.json({ ok: true });
}
