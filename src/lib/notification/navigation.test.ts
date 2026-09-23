import { describe, expect, it } from "vitest";
import { notificationHref } from "./navigation";

describe("notificationHref", () => {
  it("opens a lead when a lead notification also has a conversation", () => {
    expect(
      notificationHref({
        conversationId: 12,
        leadId: 34,
        referenceType: "lead",
        referenceId: "34",
      }),
    ).toBe("/leads?lead=34");
  });

  it("falls back to lead_id for migrated lead notifications", () => {
    expect(
      notificationHref({
        conversationId: 12,
        leadId: 34,
        referenceType: "lead",
        referenceId: null,
      }),
    ).toBe("/leads?lead=34");
  });

  it("opens the related conversation", () => {
    expect(
      notificationHref({
        conversationId: 12,
        leadId: null,
        referenceType: "conversation",
        referenceId: "12",
      }),
    ).toBe("/inbox?conversation=12");
  });

  it("does not create a link without a supported target", () => {
    expect(
      notificationHref({
        conversationId: null,
        leadId: null,
        referenceType: "job",
        referenceId: "5",
      }),
    ).toBeNull();
  });
});
