import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
export async function GET() {
  const rows = await sql`SELECT id,job_type,status,attempt_count,max_attempts,next_attempt_at,last_error_code,last_error_message,created_at,updated_at FROM jobs WHERE status IN ('RETRY','DEAD') ORDER BY updated_at DESC LIMIT 50`;
  return NextResponse.json({ items: rows });
}
