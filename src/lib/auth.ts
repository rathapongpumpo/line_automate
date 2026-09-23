import crypto from "node:crypto";
import { z } from "zod";

const sessionSchema = z.object({ email: z.email(), exp: z.number().int().positive(), iat: z.number().int().positive() });

function requiredConfig() {
  const configured = { secret: process.env.AUTH_SECRET, email: process.env.DEMO_ADMIN_EMAIL, password: process.env.DEMO_ADMIN_PASSWORD };
  if (process.env.NODE_ENV === "production" && (!configured.secret || !configured.email || !configured.password)) throw new Error("Production authentication is not configured");
  return {
    secret: configured.secret ?? "local-development-only-secret",
    email: configured.email ?? "admin@demo.local",
    password: configured.password ?? "demo1234",
  };
}

function sign(value: string) { return crypto.createHmac("sha256", requiredConfig().secret).update(value).digest("base64url"); }

export function createSession() {
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({ email: requiredConfig().email, iat: now, exp: now + 8 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySession(value?: string) {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const parsed = sessionSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString()));
    return parsed.success && parsed.data.exp > Date.now() && parsed.data.iat <= Date.now() + 60_000;
  } catch { return false; }
}

export function validDemoCredentials(email: string, password: string) {
  let config: ReturnType<typeof requiredConfig>;
  try { config = requiredConfig(); } catch { return false; }
  const a = Buffer.from(password); const b = Buffer.from(config.password);
  return email.toLowerCase() === config.email.toLowerCase() && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function authIsConfigured() {
  try { requiredConfig(); return true; } catch { return false; }
}
