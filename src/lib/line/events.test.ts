import { describe, expect, it } from "vitest";
import { normalizeLineEvent } from "./events";

const base = { webhookEventId: "evt-1", timestamp: 1700000000000, mode: "active", source: { type: "user", userId: "U123" }, deliveryContext: { isRedelivery: false } };
describe("LINE event normalization", () => {
  it.each(["text", "image", "video", "audio", "file", "location", "sticker"] as const)("normalizes %s messages", (type) => {
    const event = normalizeLineEvent({ ...base, type: "message", message: { id: `m-${type}`, type, ...(type === "text" ? { text: "hello" } : {}), ...(type === "file" ? { fileName: "unsafe.exe", fileSize: 12 } : {}) } });
    expect(event.message?.type).toBe(type); expect(event.eventId).toBe("evt-1");
  });
  it.each(["follow", "unfollow"] as const)("normalizes %s", (type) => expect(normalizeLineEvent({ ...base, type }).type).toBe(type));
  it("normalizes postback", () => expect(normalizeLineEvent({ ...base, type: "postback", postback: { data: "action=buy" } }).postbackData).toBe("action=buy"));
  it("requires a webhook event id", () => expect(() => normalizeLineEvent({ ...base, webhookEventId: undefined, type: "follow" })).toThrow());
});
