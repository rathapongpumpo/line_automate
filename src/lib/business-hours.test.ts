import { describe, expect, it } from "vitest";
import { isWithinBusinessHours } from "./business-hours";
describe("business hours", () => {
  it("handles opening and closing boundaries", () => { const hours={"1":["09:00","18:00"] as [string,string]}; expect(isWithinBusinessHours(new Date("2026-09-21T02:00:00Z"),hours)).toBe(true); expect(isWithinBusinessHours(new Date("2026-09-21T11:00:00Z"),hours)).toBe(false); });
  it("handles overnight ranges", () => { const hours={"1":["22:00","02:00"] as [string,string]}; expect(isWithinBusinessHours(new Date("2026-09-21T16:00:00Z"),hours)).toBe(true); expect(isWithinBusinessHours(new Date("2026-09-21T18:00:00Z"),hours)).toBe(true); });
});
