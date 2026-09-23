import { afterEach, describe, expect, it, vi } from "vitest";
import { createLineRetryKey, lineClient, LineApiError } from "./client";
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
describe("LINE API client", () => {
  it("derives a stable UUID retry key", () => { const key=createLineRetryKey("evt-1"); expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/); expect(createLineRetryKey("evt-1")).toBe(key); });
  it("maps a successful push and keeps the retry key", async () => {
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN","test-token");
    const fetchMock=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response("{}",{status:200,headers:{"x-line-request-id":"req-1"}}));
    await expect(lineClient.pushMessage("U123",[{type:"text",text:"hello"}],"550e8400-e29b-41d4-a716-446655440000")).resolves.toEqual({requestId:"req-1"});
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("x-line-retry-key")).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
  it("classifies 429 and 5xx as retryable", async () => {
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN","test-token");
    vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(new Response("rate limited",{status:429,headers:{"retry-after":"12"}})).mockResolvedValueOnce(new Response("down",{status:503}));
    await expect(lineClient.getProfile("U123")).rejects.toMatchObject({retryable:true,retryAfterSeconds:12});
    await expect(lineClient.getProfile("U123")).rejects.toMatchObject({retryable:true,status:503});
  });
  it("classifies permanent 4xx as non-retryable without exposing a response body", async () => {
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN","test-token");
    vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response("sensitive provider detail",{status:400}));
    await expect(lineClient.getProfile("U123")).rejects.toSatisfy((error: LineApiError)=>!error.retryable&&!error.message.includes("sensitive"));
  });
});
