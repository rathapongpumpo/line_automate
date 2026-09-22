import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";

const schema = z.object({ question: z.string().trim().min(3).max(120), answer: z.string().trim().min(3).max(500), keywords: z.array(z.string().trim().min(1)).max(12).default([]) });

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json().catch(() => null)); const { id } = await context.params;
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const rows = await sql`UPDATE faqs SET question=${parsed.data.question},answer=${parsed.data.answer},keywords=${JSON.stringify(parsed.data.keywords)}::jsonb,updated_at=${new Date().toISOString()} WHERE id=${Number(id)} RETURNING id`;
  return rows.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "ไม่พบ FAQ" }, { status: 404 });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const rows = await sql`DELETE FROM faqs WHERE id=${Number(id)} RETURNING id`;
  return rows.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "ไม่พบ FAQ" }, { status: 404 });
}
