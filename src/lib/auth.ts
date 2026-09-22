import crypto from "node:crypto";

const secret = () => process.env.AUTH_SECRET || "demo-local-auth-secret";

function sign(value: string) { return crypto.createHmac("sha256", secret()).update(value).digest("base64url"); }

export function createSession() {
  const payload = Buffer.from(JSON.stringify({ email: process.env.DEMO_ADMIN_EMAIL || "admin@demo.local", exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySession(value?: string) {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try { return (JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp: number }).exp > Date.now(); } catch { return false; }
}

export function validDemoCredentials(email: string, password: string) {
  const expectedEmail = process.env.DEMO_ADMIN_EMAIL || "admin@demo.local";
  const expectedPassword = process.env.DEMO_ADMIN_PASSWORD || "demo1234";
  const a = Buffer.from(password); const b = Buffer.from(expectedPassword);
  return email.toLowerCase() === expectedEmail.toLowerCase() && a.length === b.length && crypto.timingSafeEqual(a, b);
}
