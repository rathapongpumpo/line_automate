import { describe, expect, it } from "vitest";
import { calculateBackoffMs } from "./retry";
describe("job retry backoff", () => {
  it("uses exponential delay with deterministic jitter", () => { expect(calculateBackoffMs(1,null,()=>0.5)).toBe(1000); expect(calculateBackoffMs(4,null,()=>0.5)).toBe(8000); });
  it("respects Retry-After", () => expect(calculateBackoffMs(1,30)).toBe(30000));
});
