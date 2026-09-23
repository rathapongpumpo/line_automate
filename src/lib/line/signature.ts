import crypto from "node:crypto";

export function verifyLineSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && crypto.timingSafeEqual(actualBytes, expectedBytes);
}
