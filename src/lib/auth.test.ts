import { afterEach, describe, expect, it, vi } from "vitest";
import { authIsConfigured, createSession, verifySession } from "./auth";
afterEach(()=>vi.unstubAllEnvs());
describe("authentication baseline", () => {
  it("creates a signed, expiring session", () => { vi.stubEnv("AUTH_SECRET","a-long-test-secret"); vi.stubEnv("DEMO_ADMIN_EMAIL","admin@example.com"); vi.stubEnv("DEMO_ADMIN_PASSWORD","password123"); expect(verifySession(createSession())).toBe(true); });
  it("fails closed in production when credentials are missing", () => { vi.stubEnv("NODE_ENV","production"); vi.stubEnv("AUTH_SECRET",""); vi.stubEnv("DEMO_ADMIN_EMAIL",""); vi.stubEnv("DEMO_ADMIN_PASSWORD",""); expect(authIsConfigured()).toBe(false); });
});
