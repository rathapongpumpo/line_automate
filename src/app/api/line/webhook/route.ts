import { after, NextResponse } from "next/server";
import { normalizeLineEvent, webhookPayloadSchema } from "@/lib/line/events";
import { verifyLineSignature } from "@/lib/line/signature";
import { sql } from "@/lib/db";
import { processJobByDedupeKey } from "@/lib/jobs/worker";

export const runtime = "nodejs";
const maxBodyBytes = 1024 * 1024;

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBodyBytes) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > maxBodyBytes) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const secret = process.env.LINE_CHANNEL_SECRET ?? "";
  if (!verifyLineSignature(raw, request.headers.get("x-line-signature"), secret)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = webhookPayloadSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const accepted: Array<{ eventId: string; dedupeKey: string }> = [];
  const rejected: Array<{ index: number; error: string }> = [];
  for (const [index, rawEvent] of parsed.data.events.entries()) {
    let event;
    try {
      event = normalizeLineEvent(rawEvent);
    } catch { rejected.push({ index, error: "UNSUPPORTED_OR_INVALID_EVENT" }); }
    if (!event) continue;
    const dedupeKey = `line-event:${event.eventId}`;
    // Persistence failures must escape as 5xx so LINE redelivery can recover.
    await sql.transaction([
      sql`INSERT INTO webhook_events(event_id,event_type,source_type,source_user_id,source_group_id,source_room_id,line_timestamp,is_redelivery,payload)
          VALUES(${event.eventId},${event.type},${event.source.type},${event.source.userId ?? null},${event.source.groupId ?? null},${event.source.roomId ?? null},${event.occurredAt},${event.isRedelivery},${JSON.stringify(event)}::jsonb)
          ON CONFLICT(event_id) DO UPDATE SET is_redelivery=webhook_events.is_redelivery OR EXCLUDED.is_redelivery`,
      sql`INSERT INTO jobs(job_type,dedupe_key,payload,max_attempts) VALUES('LINE_EVENT',${dedupeKey},${JSON.stringify({ eventId: event.eventId, event })}::jsonb,8) ON CONFLICT(dedupe_key) DO NOTHING`,
    ]);
    accepted.push({ eventId: event.eventId, dedupeKey });
  }
  if (accepted.length) {
    // Best-effort latency optimization only. Durable jobs are reclaimed by the
    // authenticated worker, so correctness never depends on this callback.
    after(async () => {
      for (const item of accepted) await processJobByDedupeKey(item.dedupeKey);
    });
  }
  return NextResponse.json({ ok: true, accepted: accepted.length, rejected });
}
