import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "@/lib/db";
const schema = z.object({ question: z.string().trim().min(3).max(120), answer: z.string().trim().min(3).max(500), keywords: z.array(z.string().trim().min(1)).max(12).default([]) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "กรุณากรอกคำถามและคำตอบให้ครบ" }, { status: 400 });
  const [result] = await sql`INSERT INTO faqs(question,answer,keywords,active,updated_at) VALUES(${parsed.data.question},${parsed.data.answer},${JSON.stringify(parsed.data.keywords)}::jsonb,TRUE,${new Date().toISOString()}) RETURNING id` as {id:number}[];
  return NextResponse.json({ id: Number(result.id) }, { status: 201 });
}
