import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
const schema = z.object({ question: z.string().trim().min(3).max(120), answer: z.string().trim().min(3).max(500), keywords: z.array(z.string().trim().min(1)).max(12).default([]) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "กรุณากรอกคำถามและคำตอบให้ครบ" }, { status: 400 });
  const result = db.prepare("INSERT INTO faqs(question,answer,keywords,active,updated_at) VALUES(?,?,?,1,?)").run(parsed.data.question,parsed.data.answer,JSON.stringify(parsed.data.keywords),new Date().toISOString());
  return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 });
}
