import { describe, expect, it } from "vitest";
import { transitionTarget } from "./transitions";
describe("conversation state transitions", () => {
  it("allows takeover, resume and close", () => { expect(transitionTarget("WAITING","TAKEOVER")).toBe("ADMIN"); expect(transitionTarget("ADMIN","RESUME")).toBe("AUTO"); expect(transitionTarget("AUTO","CLOSE")).toBe("CLOSED"); });
  it("rejects invalid transitions", () => expect(() => transitionTarget("CLOSED","TAKEOVER")).toThrow("INVALID_TRANSITION"));
});
