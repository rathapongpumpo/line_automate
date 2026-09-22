import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";

const schema = z.object({ message: z.string().trim().min(1).max(500) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const { id } = await context.params;
  if (!parsed.success) return NextResponse.json({ error: "กรุณาพิมพ์ข้อความ" }, { status: 400 });
  const conversationId = Number(id);
  const stamp = new Date().toISOString();
  const found = await sql`SELECT id FROM conversations WHERE id=${conversationId}`;
  if (!found.length) return NextResponse.json({ error: "ไม่พบการสนทนา" }, { status: 404 });
  await sql.transaction([
    sql`INSERT INTO messages(conversation_id,sender,body,created_at) VALUES(${conversationId},'ADMIN',${parsed.data.message},${stamp})`,
    sql`UPDATE conversations SET status='ADMIN',last_message=${parsed.data.message},last_message_at=${stamp} WHERE id=${conversationId}`,
  ]);
  return NextResponse.json({ ok: true });
}
