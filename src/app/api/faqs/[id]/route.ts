import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({ question: z.string().trim().min(3).max(120), answer: z.string().trim().min(3).max(500), keywords: z.array(z.string().trim().min(1)).max(12).default([]) });

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json().catch(() => null)); const { id } = await context.params;
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  const result = db.prepare("UPDATE faqs SET question=?,answer=?,keywords=?,updated_at=? WHERE id=?").run(parsed.data.question, parsed.data.answer, JSON.stringify(parsed.data.keywords), new Date().toISOString(), Number(id));
  return result.changes ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "ไม่พบ FAQ" }, { status: 404 });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const result = db.prepare("DELETE FROM faqs WHERE id=?").run(Number(id));
  return result.changes ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "ไม่พบ FAQ" }, { status: 404 });
}
