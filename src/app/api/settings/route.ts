import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
const time = /^([01]\d|2[0-3]):[0-5]\d$/;
const hoursSchema = z.record(z.string().regex(/^[0-6]$/), z.tuple([z.string().regex(time), z.string().regex(time)]));
const schema = z.object({
  storeName: z.string().trim().min(2).max(80), phone: z.string().trim().min(8).max(30), welcomeMessage: z.string().trim().min(10).max(500), demoMode: z.boolean(),
  businessTimezone: z.literal("Asia/Bangkok"), businessHours: hoursSchema, awayMessage: z.string().trim().min(10).max(500), outsideHoursBot: z.boolean(),
}).strict();
export async function PUT(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "กรุณาตรวจสอบข้อมูลร้านและเวลาทำการ" }, { status: 400 });
  const d = parsed.data;
  await sql`UPDATE settings SET store_name=${d.storeName},phone=${d.phone},welcome_message=${d.welcomeMessage},demo_mode=${d.demoMode},business_timezone=${d.businessTimezone},business_hours=${JSON.stringify(d.businessHours)}::jsonb,away_message=${d.awayMessage},outside_hours_bot=${d.outsideHoursBot},channel_secret=NULL,access_token=NULL WHERE id=1`;
  return NextResponse.json({ ok: true });
}
