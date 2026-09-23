import { NextResponse } from "next/server";
import { lineClient } from "@/lib/line/client";
export async function GET() {
  const configured = Boolean(process.env.LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN);
  if (!configured) return NextResponse.json({ configured: false, connected: false });
  try { const bot = await lineClient.getBotInfo(); return NextResponse.json({ configured: true, connected: true, bot }); }
  catch { return NextResponse.json({ configured: true, connected: false }, { status: 503 }); }
}
