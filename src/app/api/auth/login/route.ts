import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, validDemoCredentials } from "@/lib/auth";

const schema = z.object({ email: z.email(), password: z.string().min(6) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !validDemoCredentials(parsed.data.email, parsed.data.password)) return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set("lsa_session", createSession(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 60 * 60 });
  return response;
}
