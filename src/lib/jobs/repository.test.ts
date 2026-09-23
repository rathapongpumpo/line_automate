import { describe, expect, it, vi } from "vitest";

const sql = vi.hoisted(() => vi.fn(async () => []));
vi.mock("@/lib/db", () => ({ sql }));
import { claimDueJobs } from "./repository";

describe("stale job reclaim", () => {
  it("atomically reclaims PROCESSING jobs older than five minutes", async () => {
    await claimDueJobs(10);
    const template = (sql.mock.calls as unknown as Array<[TemplateStringsArray]>)[0][0];
    const query = template.join("?");
    expect(query).toContain("status='PROCESSING'");
    expect(query).toContain("locked_at<NOW()-INTERVAL '5 minutes'");
    expect(query).toContain("FOR UPDATE SKIP LOCKED");
  });
});
