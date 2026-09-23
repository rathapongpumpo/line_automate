import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authIsConfigured, createSession, validDemoCredentials } from "@/lib/auth";
import { sql } from "@/lib/db";

const schema = z.object({ email: z.email(), password: z.string().min(6).max(200) });
const maxFailures = 5;

export async function POST(request: Request) {
  if (!authIsConfigured()) return NextResponse.json({ error: "Authentication is not configured" }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const key = crypto.createHash("sha256").update(`${ip}:${parsed.success ? parsed.data.email.toLowerCase() : "invalid"}`).digest("hex");
  const attempts = await sql`SELECT failure_count,window_started_at,blocked_until FROM login_attempts WHERE key_hash=${key}` as { failure_count: number; window_started_at: string; blocked_until: string | null }[];
  if (attempts[0]?.blocked_until && new Date(attempts[0].blocked_until) > new Date()) return NextResponse.json({ error: "ลองใหม่ภายหลัง" }, { status: 429, headers: { "Retry-After": "900" } });
  const valid = parsed.success && validDemoCredentials(parsed.data.email, parsed.data.password);
  if (!valid) {
    const now = new Date();
    const reset = !attempts[0] || now.getTime() - new Date(attempts[0].window_started_at).getTime() > 15 * 60_000;
    const failures = reset ? 1 : Number(attempts[0].failure_count) + 1;
    const blockedUntil = failures >= maxFailures ? new Date(now.getTime() + 15 * 60_000).toISOString() : null;
    await sql`INSERT INTO login_attempts(key_hash,failure_count,window_started_at,blocked_until,updated_at) VALUES(${key},${failures},${now.toISOString()},${blockedUntil},${now.toISOString()}) ON CONFLICT(key_hash) DO UPDATE SET failure_count=${failures},window_started_at=${reset ? now.toISOString() : attempts[0]?.window_started_at ?? now.toISOString()},blocked_until=${blockedUntil},updated_at=${now.toISOString()}`;
    await sql`INSERT INTO audit_logs(action,actor_id,subject_type,metadata) VALUES('LOGIN_FAILED',${parsed.success ? parsed.data.email.toLowerCase() : null},'AUTH',${JSON.stringify({ ipHash: key.slice(0, 16) })}::jsonb)`;
    return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: failures >= maxFailures ? 429 : 401 });
  }
  await sql.transaction([
    sql`DELETE FROM login_attempts WHERE key_hash=${key}`,
    sql`INSERT INTO audit_logs(action,actor_id,subject_type) VALUES('LOGIN_SUCCESS',${parsed.data.email.toLowerCase()},'AUTH')`,
  ]);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("lsa_session", createSession(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 60 * 60, priority: "high" });
  return response;
}
