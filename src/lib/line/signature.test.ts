import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyLineSignature } from "./signature";

describe("LINE signature", () => {
  const body = '{"events":[]}'; const secret = "test-secret";
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64");
  it("accepts an exact raw-body signature", () => expect(verifyLineSignature(body, signature, secret)).toBe(true));
  it("rejects invalid and missing signatures", () => { expect(verifyLineSignature(`${body} `, signature, secret)).toBe(false); expect(verifyLineSignature(body, null, secret)).toBe(false); });
});
