export interface CapturedFields {
  name?: string;
  phone?: string;
  color?: string;
  size?: string;
  interestedProduct?: string;
}

export interface SmartReply {
  reply: string;
  intent: "PRODUCT" | "PRICE" | "SIZE" | "SHIPPING" | "COD" | "LEAD" | "HANDOFF" | "FAQ" | "UNKNOWN";
  needsAdmin: boolean;
  shouldCreateLead: boolean;
  captured: CapturedFields;
}

const normalize = (value: string) => value.trim().toLowerCase();

export function extractCustomerData(input: string): CapturedFields {
  const text = input.trim();
  const phone = text.match(/(?:^|\s)(0\d{8,9})(?:\s|$)/)?.[1];
  const name = text.match(/(?:ผมชื่อ|ฉันชื่อ|ชื่อ)\s*([ก-๙A-Za-z]{2,30}?)(?:ครับ|ค่ะ|คะ|$|\s)/)?.[1];
  const size = text.match(/(?:ไซซ์|size)?\s*(2XL|XL|XXL|[ML])\b/i)?.[1]?.toUpperCase();
  const colorMap: Array<[RegExp, string]> = [[/สี?ดำ/i, "Black"], [/สี?ขาว/i, "White"], [/(?:สี)?เทา|charcoal/i, "Charcoal"]];
  const color = colorMap.find(([pattern]) => pattern.test(text))?.[1];
  const interestedProduct = /oversize|โอเวอร์ไซซ์|เสื้อ/i.test(text) ? "Oversize Classic" : undefined;
  return { ...(name && { name }), ...(phone && { phone }), ...(color && { color }), ...(size && { size }), ...(interestedProduct && { interestedProduct }) };
}

export function createSmartReply(
  input: string,
  faqs: Array<{ question: string; answer: string; keywords: string[] }> = [],
  options: { faqEnabled?: boolean } = {},
): SmartReply {
  const text = normalize(input);
  const captured = extractCustomerData(input);
  const leadIntent = /สนใจ|ซื้อ|สั่ง|เอา|จอง|ขอราคา/.test(text);

  if (/เจ้าหน้าที่|แอดมิน|คนจริง|คุยกับคน/.test(text)) {
    return { reply: "รับทราบครับ กำลังส่งต่อให้เจ้าหน้าที่เข้ามาช่วยดูแลนะครับ", intent: "HANDOFF", needsAdmin: true, shouldCreateLead: false, captured };
  }
  if (/ราคา|เท่าไหร่|กี่บาท/.test(text)) {
    return { reply: "Oversize Classic ราคา 690 บาทครับ", intent: "PRICE", needsAdmin: false, shouldCreateLead: leadIntent, captured: { ...captured, interestedProduct: "Oversize Classic" } };
  }
  if ((/สีดำ|black/.test(text) && /xl/.test(text)) || (/มี.*ไซซ์|มี.*ขนาด/.test(text))) {
    return { reply: "มีครับ รุ่น Oversize Classic สีดำมีไซซ์ XL พร้อมส่งครับ", intent: "PRODUCT", needsAdmin: false, shouldCreateLead: leadIntent, captured: { ...captured, interestedProduct: "Oversize Classic", color: captured.color ?? "Black", size: captured.size ?? "XL" } };
  }
  if (/ไซซ์|size|ขนาด/.test(text)) {
    return { reply: "Oversize Classic มีไซซ์ M, L, XL และ 2XL ครับ", intent: "SIZE", needsAdmin: false, shouldCreateLead: leadIntent, captured: { ...captured, interestedProduct: "Oversize Classic" } };
  }
  if (/cod|เก็บเงินปลายทาง/.test(text)) {
    return { reply: "มีบริการเก็บเงินปลายทางครับ", intent: "COD", needsAdmin: false, shouldCreateLead: leadIntent, captured };
  }
  const faq = options.faqEnabled === false ? undefined : faqs.find((item) => item.keywords.some((keyword) => text.includes(normalize(keyword))) || text.includes(normalize(item.question)));
  if (faq) {
    return { reply: faq.answer, intent: "FAQ", needsAdmin: false, shouldCreateLead: leadIntent, captured };
  }
  if (/ส่ง|จัดส่ง|กี่วัน/.test(text)) {
    return { reply: "กรุงเทพฯ 1–2 วัน ต่างจังหวัด 2–3 วันครับ", intent: "SHIPPING", needsAdmin: false, shouldCreateLead: leadIntent, captured };
  }
  if (leadIntent) {
    return { reply: "ขอบคุณครับ บันทึกความสนใจไว้แล้ว เจ้าหน้าที่จะติดต่อกลับโดยเร็วครับ", intent: "LEAD", needsAdmin: false, shouldCreateLead: true, captured: { ...captured, interestedProduct: captured.interestedProduct ?? "Oversize Classic" } };
  }
  if (captured.name || captured.phone) {
    return { reply: "บันทึกข้อมูลให้แล้วครับ ต้องการสอบถามสินค้า ราคา ไซซ์ หรือการจัดส่งเพิ่มเติมได้เลยครับ", intent: "LEAD", needsAdmin: false, shouldCreateLead: Boolean(captured.phone), captured };
  }
  return { reply: "คำถามนี้ขอให้เจ้าหน้าที่ช่วยดูให้นะครับ", intent: "UNKNOWN", needsAdmin: true, shouldCreateLead: false, captured };
}
