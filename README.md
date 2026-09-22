# LINE Sales Assistant

ระบบ Demo สำหรับร้านค้าออนไลน์ที่รวมแชต LINE OA, ลูกค้า, Lead, FAQ Automation และ Human Handoff ไว้ใน Dashboard เดียว ใช้ Next.js, TypeScript, Tailwind CSS และ Neon PostgreSQL

## เปิดระบบ

```bash
npm install
copy .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

ใส่ Neon connection string ใน `DATABASE_URL` แล้วเปิด `http://localhost:3000` Login ด้วย `admin@demo.local` / `demo1234` คำสั่ง seed จะข้ามการทำงานอัตโนมัติเมื่อมีข้อมูลลูกค้าอยู่แล้ว

## Golden Demo Flow

1. เปิด Dashboard แล้วกด “เปิด Demo ลูกค้า”
2. ส่ง `มีเสื้อสีดำ XL ไหม` และ `ราคาเท่าไหร่`
3. ส่ง `สนใจครับ เบอร์ 0812345678`
4. เปิด Dashboard/Leads เพื่อดู Lead ใหม่
5. กลับ Demo ส่ง `ขอคุยกับเจ้าหน้าที่`
6. เปิด Inbox เลือกลูกค้า Demo แล้วกด “รับช่วงสนทนา”

## เชื่อม LINE OA จริง

กำหนด `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `AUTH_SECRET`, `DATABASE_URL` และ `NEXT_PUBLIC_APP_URL` ใน environment ของ server จากนั้นรัน `npm run db:migrate` และ `npm run db:seed` หนึ่งครั้ง ตั้ง Webhook URL ใน LINE Developers Console เป็น `https://your-domain/api/line/webhook` เปิด Use webhook และกด Verify ระบบตรวจ `x-line-signature` จาก raw body ก่อนประมวลผลและกัน event ซ้ำด้วย `webhookEventId`

Deploy บน Vercel ได้โดยเชื่อม Neon Integration ให้มี `DATABASE_URL` แล้วรัน migration/seed ก่อน Redeploy ระบบใช้ Neon serverless driver จึงไม่พึ่ง filesystem ของ Vercel

## ตรวจสอบ

```bash
npm run verify
```

ข้อจำกัด: authentication เป็น Demo admin เดียว, rule-based response ยังไม่ใช้ AI, notification อยู่ใน Dashboard, ไม่มี payment/order/inventory workflow ตามขอบเขตเวอร์ชันนี้
