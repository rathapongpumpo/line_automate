import { beforeEach, describe, expect, it, vi } from "vitest";

const processDueJobs = vi.hoisted(() => vi.fn(async () => [{ id: 1, status: "COMPLETED" }]));
vi.mock("@/lib/jobs/worker", () => ({ processDueJobs }));
import { GET, POST } from "./route";

const request = (method: string, token?: string) => new Request("http://localhost/api/jobs/worker", {
  method, headers: token ? { authorization: `Bearer ${token}` } : {},
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("INTERNAL_JOB_SECRET", "internal-secret");
  vi.stubEnv("CRON_SECRET", "cron-secret");
});

describe("worker authentication", () => {
  it("fails closed when a secret is missing or incorrect", async () => {
    expect((await POST(request("POST"))).status).toBe(401);
    expect((await POST(request("POST", "wrong"))).status).toBe(401);
    vi.stubEnv("INTERNAL_JOB_SECRET", "");
    expect((await POST(request("POST", "internal-secret"))).status).toBe(401);
    expect(processDueJobs).not.toHaveBeenCalled();
  });
  it("accepts external POST only with INTERNAL_JOB_SECRET", async () => {
    expect((await POST(request("POST", "internal-secret"))).status).toBe(200);
    expect(processDueJobs).toHaveBeenCalledWith(10);
  });
  it("accepts Vercel Cron GET only with CRON_SECRET", async () => {
    expect((await GET(request("GET", "wrong"))).status).toBe(401);
    expect((await GET(request("GET", "cron-secret"))).status).toBe(200);
  });
});
