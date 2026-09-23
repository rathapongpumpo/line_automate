import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
import { createOutboundRecord } from "@/lib/conversation/service";
import { enqueueJob } from "@/lib/jobs/repository";
import { processJobByDedupeKey } from "@/lib/jobs/worker";

const schema = z.object({ message: z.string().trim().min(1).max(500), idempotencyKey: z.uuid() });

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const conversationId = Number(id);
  const url = new URL(request.url);
  const before = Number(url.searchParams.get("before") ?? 0);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
  if (!Number.isInteger(conversationId)) return NextResponse.json({ error: "Conversation ไม่ถูกต้อง" }, { status: 400 });
  const rows = before > 0
    ? await sql`SELECT * FROM messages WHERE conversation_id=${conversationId} AND id<${before} ORDER BY id DESC LIMIT ${limit}`
    : await sql`SELECT * FROM messages WHERE conversation_id=${conversationId} ORDER BY id DESC LIMIT ${limit}`;
  return NextResponse.json({ items: rows.reverse(), nextBefore: rows.length === limit ? Number((rows[0] as { id: number }).id) : null });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const { id } = await context.params;
  if (!parsed.success) return NextResponse.json({ error: "กรุณาพิมพ์ข้อความและระบุ idempotency key" }, { status: 400 });
  const conversationId = Number(id);
  const found = await sql`SELECT id,status FROM conversations WHERE id=${conversationId}` as { id: number; status: string }[];
  if (!found.length) return NextResponse.json({ error: "ไม่พบการสนทนา" }, { status: 404 });
  if (found[0].status !== "ADMIN") return NextResponse.json({ error: "ต้องรับช่วงการสนทนาก่อนส่งข้อความ" }, { status: 409 });
  const record = await createOutboundRecord(conversationId, "ADMIN", parsed.data.message, parsed.data.idempotencyKey);
  const dedupeKey = `outbound:${record.id}`;
  await enqueueJob("OUTBOUND_PUSH", dedupeKey, { messageId: record.id });
  await processJobByDedupeKey(dedupeKey);
  const [message] = await sql`SELECT * FROM messages WHERE id=${record.id}`;
  return NextResponse.json({ message });
}
