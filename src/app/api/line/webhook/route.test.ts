import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction, processJob, afterCallbacks, afterMock } = vi.hoisted(() => ({
  transaction: vi.fn(async () => []),
  processJob: vi.fn(async () => ({ status: "COMPLETED" })),
  afterCallbacks: [] as Array<() => Promise<void>>,
  afterMock: vi.fn((callback: () => Promise<void>) => { afterCallbacks.push(callback); }),
}));
vi.mock("next/server", async () => ({ ...(await vi.importActual<typeof import("next/server")>("next/server")), after: afterMock }));
vi.mock("@/lib/db", () => ({ sql: Object.assign(vi.fn(() => []), { transaction }) }));
vi.mock("@/lib/jobs/worker", () => ({ processJobByDedupeKey: processJob }));
import { POST } from "./route";

const secret = "webhook-test-secret";
function request(body: string, signed = true) {
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64");
  return new Request("http://localhost/api/line/webhook", { method: "POST", headers: { "content-type": "application/json", ...(signed ? { "x-line-signature": signature } : {}) }, body });
}
beforeEach(()=>{vi.stubEnv("LINE_CHANNEL_SECRET",secret);transaction.mockClear();processJob.mockReset().mockResolvedValue({status:"COMPLETED"});afterMock.mockClear();afterCallbacks.length=0;});
describe("LINE webhook route", () => {
  it("rejects an invalid signature before durable writes", async () => { const response=await POST(request('{"events":[]}',false)); expect(response.status).toBe(401); expect(transaction).not.toHaveBeenCalled(); });
  it("returns 400 for malformed JSON", async () => expect((await POST(request("{"))).status).toBe(400));
  it("accepts an empty verification payload", async () => { const response=await POST(request('{"destination":"U","events":[]}')); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({accepted:0}); });
  it("durably accepts without waiting for downstream processing", async () => {
    const body=JSON.stringify({events:[{webhookEventId:"evt-1",type:"message",timestamp:1700000000000,mode:"active",source:{type:"user",userId:"U123"},message:{id:"m-1",type:"text",text:"สนใจสินค้า"},replyToken:"reply"}]});
    processJob.mockImplementationOnce(() => new Promise(() => undefined));
    const response=await POST(request(body));
    expect(response.status).toBe(200);
    expect(transaction).toHaveBeenCalledOnce();
    expect(processJob).not.toHaveBeenCalled();
    expect(afterMock).toHaveBeenCalledOnce();
  });
  it("redelivery uses the same durable job key and cannot dispatch twice concurrently", async () => {
    const body=JSON.stringify({events:[{webhookEventId:"evt-1",type:"message",timestamp:1700000000000,mode:"active",deliveryContext:{isRedelivery:true},source:{type:"user",userId:"U123"},message:{id:"m-1",type:"text",text:"ซ้ำ"},replyToken:"reply"}]});
    await POST(request(body)); await POST(request(body));
    expect(transaction).toHaveBeenCalledTimes(2);
    await afterCallbacks[0](); await afterCallbacks[1]();
    expect(processJob).toHaveBeenNthCalledWith(1,"line-event:evt-1");
    expect(processJob).toHaveBeenNthCalledWith(2,"line-event:evt-1");
  });
});
