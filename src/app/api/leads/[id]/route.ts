import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({ status: z.enum(["NEW", "CONTACTED", "INTERESTED", "WON", "LOST"]) });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json().catch(() => null)); const { id } = await context.params;
  if (!parsed.success) return NextResponse.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
  const result = db.prepare("UPDATE leads SET status=?,updated_at=? WHERE id=?").run(parsed.data.status, new Date().toISOString(), Number(id));
  return result.changes ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "ไม่พบ Lead" }, { status: 404 });
}
