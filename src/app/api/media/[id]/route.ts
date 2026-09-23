import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Media ไม่ถูกต้อง" }, { status: 400 });
  const rows = await sql`SELECT media_storage_key,file_name FROM messages WHERE id=${Number(id)}` as { media_storage_key: string | null; file_name: string | null }[];
  if (!rows[0]?.media_storage_key) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });
  const blob = await get(rows[0].media_storage_key, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
  if (!blob || blob.statusCode !== 200) return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });
  return new Response(blob.stream, { headers: { "Content-Type": blob.blob.contentType, "Content-Disposition": `attachment; filename="${encodeURIComponent(rows[0].file_name ?? "line-media")}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=300" } });
}
