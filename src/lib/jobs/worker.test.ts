import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claimDueJobs: vi.fn(), completeJob: vi.fn(), failJob: vi.fn(), createNotification: vi.fn(), processLineEvent: vi.fn(), sql: vi.fn(async () => []),
}));
vi.mock("./repository", () => ({
  claimDueJobs: mocks.claimDueJobs, claimJobByDedupeKey: vi.fn(), completeJob: mocks.completeJob, failJob: mocks.failJob,
}));
vi.mock("@/lib/db", () => ({ sql: mocks.sql }));
vi.mock("@/lib/notification/service", () => ({ createNotification: mocks.createNotification }));
vi.mock("@/lib/line/processor", () => ({
  processLineEvent: mocks.processLineEvent, processOutboundMessage: vi.fn(), processProfileSync: vi.fn(), processMediaFetch: vi.fn(),
}));
vi.mock("@/lib/line/client", () => ({ LineApiError: class extends Error {} }));
import { processDueJobs } from "./worker";

const job = { id: 4, job_type: "LINE_EVENT", payload: { eventId: "evt", event: {} }, attempt_count: 1, max_attempts: 2 };
beforeEach(() => { vi.clearAllMocks(); mocks.claimDueJobs.mockResolvedValue([job]); mocks.processLineEvent.mockRejectedValue(Object.assign(new Error("downstream"), { retryable: true })); });

describe("durable worker failure paths", () => {
  it("schedules a retry for a retryable failure", async () => {
    mocks.failJob.mockResolvedValue(false);
    expect(await processDueJobs(10)).toEqual([{ id: 4, status: "RETRY" }]);
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });
  it("dead-letters exhausted work and notifies once", async () => {
    mocks.failJob.mockResolvedValue(true);
    expect(await processDueJobs(10)).toEqual([{ id: 4, status: "DEAD" }]);
    expect(mocks.createNotification).toHaveBeenCalledWith(expect.objectContaining({ dedupeKey: "job-dead:4" }));
  });
});
