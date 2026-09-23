import { NextResponse } from "next/server";
import { transitionConversation } from "@/lib/conversation/service";
export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Conversation ไม่ถูกต้อง" }, { status: 400 });
  try { const result = await transitionConversation(Number(id), "TAKEOVER"); return result.found ? NextResponse.json({ ok: true, status: result.to }) : NextResponse.json({ error: "ไม่พบการสนทนา" }, { status: 404 }); }
  catch { return NextResponse.json({ error: "สถานะปัจจุบันไม่อนุญาตให้รับช่วง" }, { status: 409 }); }
}
