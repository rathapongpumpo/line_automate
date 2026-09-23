import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs/repository";
import { processJobByDedupeKey } from "@/lib/jobs/worker";
export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Message ไม่ถูกต้อง" }, { status: 400 });
  const messageId = Number(id);
  const rows = await sql`SELECT id,delivery_status FROM messages WHERE id=${messageId} AND sender IN ('ADMIN','SYSTEM')` as { id: number; delivery_status: string }[];
  if (!rows.length) return NextResponse.json({ error: "ไม่พบข้อความ" }, { status: 404 });
  if (rows[0].delivery_status === "SENT") return NextResponse.json({ ok: true, status: "SENT" });
  await sql`UPDATE jobs SET status='PENDING',next_attempt_at=NOW(),updated_at=NOW() WHERE dedupe_key=${`outbound:${messageId}`} AND status IN ('RETRY','DEAD')`;
  await enqueueJob("OUTBOUND_PUSH", `outbound:${messageId}`, { messageId });
  await processJobByDedupeKey(`outbound:${messageId}`);
  const [message] = await sql`SELECT delivery_status,last_error_code FROM messages WHERE id=${messageId}`;
  return NextResponse.json({ ok: true, message });
}
