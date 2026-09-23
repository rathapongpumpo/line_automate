import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ sql: {} }));
import { evaluateAutomationWithRules, type RuleSet } from "./engine";
const allOn: RuleSet = { autoFaq: true, autoLead: true, notifyUnknown: true, notifyIntent: true, intentKeywords: ["สนใจ"] };
const faq = [{ question: "ใบเสร็จ", answer: "ออกใบเสร็จได้", keywords: ["ใบเสร็จ"] }];
describe("runtime automation rules", () => {
  it("turns FAQ matching off", () => expect(evaluateAutomationWithRules("ขอใบเสร็จ", { ...allOn, autoFaq: false }, faq).intent).toBe("UNKNOWN"));
  it("turns automatic lead creation off", () => expect(evaluateAutomationWithRules("สนใจซื้อเสื้อ", { ...allOn, autoLead: false }).shouldCreateLead).toBe(false));
  it("records unknown without a false handoff when notification is off", () => expect(evaluateAutomationWithRules("คำถามเฉพาะ", { ...allOn, notifyUnknown: false })).toMatchObject({ needsAdmin: false, shouldReply: false }));
  it("uses configured intent keywords only when enabled", () => { expect(evaluateAutomationWithRules("สนใจเสื้อ", allOn).notifyIntent).toBe(true); expect(evaluateAutomationWithRules("สนใจเสื้อ", { ...allOn, notifyIntent: false }).notifyIntent).toBe(false); });
});
