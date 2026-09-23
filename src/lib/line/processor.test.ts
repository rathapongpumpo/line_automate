import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedLineEvent } from "./events";

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  createOutboundRecord: vi.fn(),
  ensureCustomer: vi.fn(),
  openConversation: vi.fn(),
  saveInboundMessage: vi.fn(),
  pushMessage: vi.fn(),
  replyMessage: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ sql: mocks.sql }));
vi.mock("@/lib/conversation/service", () => ({
  createOutboundRecord: mocks.createOutboundRecord,
  ensureCustomer: mocks.ensureCustomer,
  openConversation: mocks.openConversation,
  saveInboundMessage: mocks.saveInboundMessage,
}));
vi.mock("@/lib/line/client", () => ({
  lineClient: { pushMessage: mocks.pushMessage, replyMessage: mocks.replyMessage, getProfile: vi.fn() },
  classifyLineError: (error: unknown) => error,
  createLineRetryKey: (value: string) => value,
}));
vi.mock("@/lib/automation/engine", () => ({ loadRuleSet: vi.fn(), evaluateAutomation: vi.fn() }));
vi.mock("@/lib/jobs/repository", () => ({ enqueueJob: vi.fn() }));
vi.mock("@/lib/lead/service", () => ({ upsertLead: vi.fn() }));
vi.mock("@/lib/notification/service", () => ({ createNotification: vi.fn() }));
vi.mock("@/lib/media/storage", () => ({ storeLineMedia: vi.fn() }));

import { processLineEvent, processOutboundMessage } from "./processor";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DEMO_MODE", "true");
  mocks.pushMessage.mockResolvedValue({ requestId: "req-1" });
});

describe("outbound delivery isolation", () => {
  it("calls LINE Push for a real recipient even when DEMO_MODE=true", async () => {
    mocks.sql
      .mockResolvedValueOnce([{ id: 7, conversation_id: 9, body: "hello", external_id: "retry-key" }])
      .mockResolvedValueOnce([{ line_user_id: "U_REAL", unfollowed_at: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await processOutboundMessage(7);
    expect(mocks.pushMessage).toHaveBeenCalledWith("U_REAL", [{ type: "text", text: "hello" }], "retry-key");
  });

  it("simulates only U_DEMO and never calls LINE", async () => {
    mocks.sql
      .mockResolvedValueOnce([{ id: 7, conversation_id: 9, body: "hello", external_id: "retry-key" }])
      .mockResolvedValueOnce([{ line_user_id: "U_DEMO", unfollowed_at: null }])
      .mockResolvedValueOnce([]);
    await processOutboundMessage(7);
    expect(mocks.pushMessage).not.toHaveBeenCalled();
  });

  it("does not create an outbound record for a standby event", async () => {
    mocks.ensureCustomer.mockResolvedValue({ id: 1, profile_synced_at: "2026-01-01T00:00:00.000Z" });
    mocks.openConversation.mockResolvedValue({ id: 2, status: "AUTO", stale: false });
    mocks.sql.mockResolvedValueOnce([{ welcome_message: "welcome" }]);
    const event: NormalizedLineEvent = {
      eventId: "standby-1", type: "follow", occurredAt: "2026-01-01T00:00:00.000Z",
      isRedelivery: false, mode: "standby", source: { type: "user", userId: "U_REAL" },
    };
    await processLineEvent(event);
    expect(mocks.createOutboundRecord).not.toHaveBeenCalled();
    expect(mocks.replyMessage).not.toHaveBeenCalled();
  });

  it("does not create a second message or reply for redelivery", async () => {
    mocks.ensureCustomer.mockResolvedValue({ id: 1, profile_synced_at: "2026-01-01T00:00:00.000Z" });
    mocks.openConversation.mockResolvedValue({ id: 2, status: "AUTO", stale: false });
    mocks.saveInboundMessage.mockResolvedValue(null);
    const event: NormalizedLineEvent = {
      eventId: "duplicate-1", type: "message", occurredAt: "2026-01-01T00:00:00.000Z",
      isRedelivery: true, mode: "active", source: { type: "user", userId: "U_REAL" },
      message: { id: "message-1", type: "text", text: "duplicate", metadata: {} }, replyToken: "reply",
    };
    await processLineEvent(event);
    expect(mocks.saveInboundMessage).toHaveBeenCalledOnce();
    expect(mocks.createOutboundRecord).not.toHaveBeenCalled();
    expect(mocks.replyMessage).not.toHaveBeenCalled();
  });
});
