import { describe, expect, it } from "vitest";
import { createSmartReply, extractCustomerData } from "./automation";

describe("demo automation", () => {
  it("answers product availability", () => {
    const result = createSmartReply("มีเสื้อสีดำ XL ไหม");
    expect(result.intent).toBe("PRODUCT");
    expect(result.reply).toContain("พร้อมส่ง");
    expect(result.captured).toMatchObject({ color: "Black", size: "XL" });
  });

  it("captures lead data", () => {
    expect(extractCustomerData("ผมชื่อเป้ครับ สนใจสีดำ XL เบอร์ 0812345678")).toMatchObject({
      name: "เป้", phone: "0812345678", color: "Black", size: "XL",
    });
  });

  it("hands unknown questions to admin", () => {
    expect(createSmartReply("ช่วยออกใบกำกับภาษีแบบพิเศษได้ไหม").needsAdmin).toBe(true);
  });
});
