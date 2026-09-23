import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString?.startsWith("postgres")) throw new Error("DATABASE_URL must be a PostgreSQL connection string");
const sql = neon(connectionString);
const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM customers`;
if (count > 0) {
  console.log(`Seed skipped: customers already contains ${count} rows.`);
  process.exit(0);
}

const iso = (minutesAgo = 0) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const customerSeed = [
  ["U001", "สมชาย", "0892345678", "somchai@example.com", ["ลูกค้าใหม่", "สนใจสินค้า"], "Oversize Classic", "Black", "XL"],
  ["U002", "เมย์", "0817284102", null, ["VIP"], "Everyday Tee", "White", "M"],
  ["U003", "นนท์", "0946282011", null, ["ต้อง Follow-up"], "Oversize Classic", "Charcoal", "L"],
  ["U004", "พลอย", "0869012488", "ploy@example.com", ["สนใจสินค้า"], "Minimal Polo", "White", "M"],
  ["U005", "กิตติ", "0991028374", null, ["ลูกค้าใหม่"], "Oversize Classic", "Black", "2XL"],
  ["U006", "แอน", "0836642109", null, ["VIP"], "Everyday Tee", "Black", "L"],
  ["U007", "วรรณ", "0957261900", null, ["ต้อง Follow-up"], "Minimal Polo", "Charcoal", "XL"],
  ["U008", "ธนา", "0828881054", null, ["ลูกค้าใหม่"], "Oversize Classic", "White", "M"],
  ["U009", "อร", "0871123904", null, ["สนใจสินค้า"], "Everyday Tee", "White", "L"],
  ["U010", "ภพ", "0804412857", null, ["ลูกค้าใหม่"], "Oversize Classic", "Black", "XL"],
];
const customerIds = [];
for (const [lineUserId, name, phone, email, tags, product, color, size] of customerSeed) {
  const [row] = await sql`
    INSERT INTO customers(line_user_id,display_name,name,phone,email,tags,interested_product,color,size,created_at,updated_at)
    VALUES(${lineUserId},${name},${name},${phone},${email},${JSON.stringify(tags)}::jsonb,${product},${color},${size},${iso(12000 + customerIds.length * 400)},${iso(customerIds.length * 17)})
    RETURNING id`;
  customerIds.push(Number(row.id));
}

const conversationSeed = [
  [0, "AUTO", "มีสีดำ XL ไหมครับ", 2], [1, "WAITING", "ขอคุยกับเจ้าหน้าที่ค่ะ", 8], [2, "ADMIN", "ขอบคุณครับ", 16], [3, "CLOSED", "ได้รับสินค้าแล้วค่ะ", 80],
  [4, "AUTO", "ราคาเท่าไหร่ครับ", 120], [5, "AUTO", "ส่งของกี่วันคะ", 180], [6, "WAITING", "มีใบกำกับภาษีไหมคะ", 220], [7, "CLOSED", "โอเคครับ", 390],
  [8, "ADMIN", "สนใจสีขาว L ค่ะ", 520], [9, "AUTO", "มีเก็บเงินปลายทางไหมครับ", 700], [1, "CLOSED", "เปลี่ยนไซซ์เรียบร้อยค่ะ", 900], [2, "AUTO", "มีโปรอะไรบ้าง", 1100],
  [3, "CLOSED", "ขอบคุณค่ะ", 1500], [4, "ADMIN", "เบอร์ 0991028374 ครับ", 1800], [5, "CLOSED", "สั่งซื้อแล้วค่ะ", 2100], [7, "AUTO", "ไซซ์ M ยังมีไหมครับ", 2400],
];
const conversationIds = [];
for (const [customerIndex, status, lastMessage, minutesAgo] of conversationSeed) {
  const [conversation] = await sql`
    INSERT INTO conversations(customer_id,status,last_message,last_message_at,created_at)
    VALUES(${customerIds[customerIndex]},${status},${lastMessage},${iso(minutesAgo)},${iso(minutesAgo + 30)}) RETURNING id`;
  conversationIds.push(Number(conversation.id));
  await sql`INSERT INTO messages(conversation_id,sender,body,created_at) VALUES(${conversation.id},'CUSTOMER',${lastMessage},${iso(minutesAgo)})`;
  if (status !== "WAITING") {
    await sql`INSERT INTO messages(conversation_id,sender,body,created_at) VALUES(${conversation.id},${status === "ADMIN" ? "ADMIN" : "SYSTEM"},${status === "ADMIN" ? "รับช่วงดูแลให้แล้วครับ" : "ยินดีช่วยดูแลครับ สอบถามเพิ่มเติมได้เลย"},${iso(minutesAgo - 1)})`;
  }
}

const leadStatuses = ["INTERESTED", "NEW", "CONTACTED", "WON", "NEW", "WON", "LOST", "CONTACTED", "INTERESTED", "NEW"];
const leadIds = [];
for (let index = 0; index < customerSeed.length; index += 1) {
  const [lead] = await sql`INSERT INTO leads(customer_id,product,phone,status,source,owner,created_at,updated_at)
    VALUES(${customerIds[index]},${customerSeed[index][5]},${customerSeed[index][2]},${leadStatuses[index]},'LINE OA',${index % 3 === 0 ? "ณิชา" : "ทีมขาย"},${iso(index * 240 + 20)},${iso(index * 90)}) RETURNING id`;
  leadIds.push(Number(lead.id));
}

const faqSeed = [
  ["ส่งของกี่วัน", "กรุงเทพฯ 1–2 วัน ต่างจังหวัด 2–3 วันครับ", ["ส่ง", "จัดส่ง", "กี่วัน"]],
  ["มีเก็บเงินปลายทางไหม", "มีบริการเก็บเงินปลายทางครับ", ["COD", "เก็บเงินปลายทาง"]],
  ["เปลี่ยนไซซ์ได้ไหม", "สามารถเปลี่ยนไซซ์ภายใน 7 วัน สินค้าต้องอยู่ในสภาพเดิมครับ", ["เปลี่ยนไซซ์", "เปลี่ยนขนาด"]],
  ["ค่าจัดส่งเท่าไหร่", "ค่าจัดส่ง 50 บาท ซื้อครบ 1,500 บาทส่งฟรีครับ", ["ค่าส่ง", "ค่าจัดส่ง"]],
  ["ชำระเงินช่องทางไหนได้บ้าง", "ชำระผ่านโอนธนาคารและพร้อมเพย์ได้ครับ", ["ชำระ", "โอน", "พร้อมเพย์"]],
  ["มีหน้าร้านไหม", "WLB Store จำหน่ายออนไลน์ผ่าน LINE OA เป็นหลักครับ", ["หน้าร้าน", "ที่ร้าน"]],
  ["ขอใบเสร็จได้ไหม", "ออกใบเสร็จรับเงินได้ กรุณาแจ้งชื่อและที่อยู่กับเจ้าหน้าที่ครับ", ["ใบเสร็จ"]],
  ["ติดตามพัสดุอย่างไร", "หลังจัดส่ง ระบบจะแจ้งเลขติดตามพัสดุผ่าน LINE ครับ", ["ติดตาม", "เลขพัสดุ"]],
];
for (let index = 0; index < faqSeed.length; index += 1) {
  await sql`INSERT INTO faqs(question,answer,keywords,active,updated_at) VALUES(${faqSeed[index][0]},${faqSeed[index][1]},${JSON.stringify(faqSeed[index][2])}::jsonb,TRUE,${iso(index * 200)})`;
}

for (const product of [
  ["Oversize Classic", 690, ["Black", "White", "Charcoal"], ["M", "L", "XL", "2XL"], 84],
  ["Everyday Tee", 490, ["Black", "White"], ["S", "M", "L", "XL"], 61],
  ["Minimal Polo", 790, ["White", "Charcoal"], ["M", "L", "XL"], 37],
]) {
  await sql`INSERT INTO products(name,price,colors,sizes,stock,active) VALUES(${product[0]},${product[1]},${JSON.stringify(product[2])}::jsonb,${JSON.stringify(product[3])}::jsonb,${product[4]},TRUE)`;
}

for (const rule of [
  ["auto_faq", "ตอบ FAQ อัตโนมัติ", "ค้นหาคำตอบจากคำถามที่พบบ่อย", null],
  ["auto_lead", "เก็บ Lead อัตโนมัติ", "สร้าง Lead เมื่อพบความสนใจหรือข้อมูลติดต่อ", null],
  ["notify_unknown", "แจ้ง Admin เมื่อระบบตอบไม่ได้", "เปลี่ยนสถานะเป็น WAITING และสร้างการแจ้งเตือน", null],
  ["notify_intent", "แจ้งเมื่อมีความตั้งใจซื้อ", "ตรวจคำว่า ซื้อ, สั่ง, สนใจ, ขอราคา", "ซื้อ,สั่ง,สนใจ,ขอราคา"],
]) {
  await sql`INSERT INTO automation_rules(rule_key,label,description,enabled,value) VALUES(${rule[0]},${rule[1]},${rule[2]},TRUE,${rule[3]})`;
}

for (const notice of [
  ["WAITING", "ลูกค้ารอ Admin", "เมย์ขอคุยกับเจ้าหน้าที่", false, 5, 1, 1, null],
  ["LEAD", "Lead ใหม่", "สมชายสนใจ Oversize Classic", false, 12, 0, 0, 0],
  ["UNKNOWN", "ระบบตอบไม่ได้", "วรรณสอบถามใบกำกับภาษี", false, 30, 6, 6, null],
  ["INTENT", "พบความตั้งใจซื้อ", "อรสนใจสีขาว L", true, 90, 8, 8, null],
  ["LEAD", "Lead ใหม่", "กิตติแจ้งเบอร์ติดต่อ", true, 150, 4, 4, 4],
]) {
  const customerIndex = Number(notice[5]);
  const conversationIndex = Number(notice[6]);
  const leadIndex = notice[7] === null ? null : Number(notice[7]);
  const referenceType = leadIndex === null ? "conversation" : "lead";
  const referenceId = leadIndex === null ? conversationIds[conversationIndex] : leadIds[leadIndex];
  await sql`INSERT INTO notifications(type,title,body,is_read,created_at,conversation_id,customer_id,lead_id,reference_type,reference_id)
    VALUES(${notice[0]},${notice[1]},${notice[2]},${notice[3]},${iso(notice[4])},${conversationIds[conversationIndex]},${customerIds[customerIndex]},${leadIndex === null ? null : leadIds[leadIndex]},${referenceType},${String(referenceId)})`;
}

await sql`INSERT INTO settings(id,store_name,phone,welcome_message,demo_mode,channel_id,channel_secret,access_token)
  VALUES(1,'WLB Store','02-123-4567','สวัสดีครับ 👋\nยินดีต้อนรับสู่ WLB Store\nสอบถามสินค้า ราคา ไซซ์ หรือการจัดส่งได้เลยครับ',${process.env.DEMO_MODE !== "false"},NULL,NULL,NULL)`;

console.log("Neon seed completed.");
