# LINE Sales Assistant — Phase 0 Real LINE Core

ระบบ Inbox/Automation ภาษาไทยสำหรับ LINE OA บน Next.js 16.3.5, Neon PostgreSQL และ Vercel ขอบเขตปัจจุบันคือ Phase 0: รับ webhook จริง, profile sync, automation rules, human handoff, outbound delivery state, retry/dead-letter และ media metadata/storage

## เริ่มระบบ Local

```powershell
npm install
Copy-Item .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

Development มี demo credential fallback เพื่อใช้งาน local เท่านั้น Production จะ fail closed หากไม่มี `AUTH_SECRET`, `DEMO_ADMIN_EMAIL` หรือ `DEMO_ADMIN_PASSWORD`

## Environment variables

- `DATABASE_URL`, `DATABASE_URL_UNPOOLED`: Neon PostgreSQL
- `AUTH_SECRET`, `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`: single-admin pilot authentication
- `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`: source of truth เดียวของ LINE credentials; browser และตาราง `settings` ไม่รับ secret/token
- `NEXT_PUBLIC_APP_URL`: public origin สำหรับ Webhook URL
- `DEMO_MODE`: ใช้เปิดพฤติกรรมหน้า Demo เท่านั้น; outbound จะจำลองเฉพาะ customer `U_DEMO` โดยไม่ขึ้นกับค่านี้
- `INTERNAL_JOB_SECRET`: Bearer secret สำหรับ `POST /api/jobs/worker`
- `CRON_SECRET`: Bearer secret ที่ Vercel Cron ส่งให้ `GET /api/jobs/worker`
- `MEDIA_STORAGE_PROVIDER`: `vercel-blob` เพื่อเก็บ media หรือ `none` เพื่อเก็บเฉพาะ metadata
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob token เมื่อใช้ provider ดังกล่าว

ใช้ placeholder ใน `.env.example` เท่านั้น ห้าม commit `.env.local`

## LINE Developers Console

1. ตั้ง Webhook URL เป็น `https://your-domain/api/line/webhook`
2. เปิด Use webhook และ Webhook redelivery
3. ปิด Greeting/Auto-response ที่ชนกับระบบนี้ตาม policy ของร้าน
4. กด Verify; empty `events` จะตอบ `200`
5. ตรวจ connection จาก Settings โดยระบบเรียก Get bot info ฝั่ง server และไม่ส่ง token ไป browser

Webhook ตรวจ `x-line-signature` จาก raw UTF-8 body ก่อน parse จำกัด body 1 MiB และใช้ `webhookEventId` เป็น durable dedupe key

## Runtime architecture

- `src/lib/line`: signature, typed event normalization, LINE HTTP client และ event processor
- `src/lib/automation`: runtime rules (`auto_faq`, `auto_lead`, `notify_unknown`, `notify_intent`)
- `src/lib/conversation`, `lead`, `notification`: idempotent domain services และ state transition audit
- `webhook_events` + `jobs`: PostgreSQL durable inbox/outbox, retry ด้วย exponential backoff+jitter และ dead-letter
- `GET /api/jobs/worker`: Vercel Cron endpoint ที่ fail-closed และรับเฉพาะ `Authorization: Bearer <CRON_SECRET>`
- `POST /api/jobs/worker`: external worker endpoint ที่ fail-closed และรับเฉพาะ `Authorization: Bearer <INTERNAL_JOB_SECRET>`
- Admin outbound สร้าง message ก่อนส่ง ใช้ client idempotency key และส่ง Push Message ด้วย `X-Line-Retry-Key`

Webhook commit event+job ใน transaction แล้วตอบทันที `after()` เป็นเพียง best-effort ลด latency ความถูกต้องพึ่ง durable worker ซึ่ง reclaim งาน `PROCESSING` ที่ค้างเกิน 5 นาทีและ retry ด้วย retry key เดิม

`vercel.json` ตั้ง Cron `00:00 UTC` รายวันซึ่งรองรับทุก plan เป็น safety net เท่านั้น Vercel Hobby รองรับถี่สุดวันละครั้งและเวลาอาจคลาดเคลื่อน หากต้องการ retry ใกล้ real time ให้ตั้ง external scheduler เรียก POST ทุก 1–5 นาที หรือใช้ Vercel Pro/Enterprise แล้วเปลี่ยน schedule เป็นทุกนาที

## Media

รองรับ text, image, video, audio, file, location, sticker, follow, unfollow และ postback ถ้าตั้ง `MEDIA_STORAGE_PROVIDER=vercel-blob` ระบบจะดาวน์โหลด content, จำกัด 10 MiB, allowlist MIME, ตั้ง object name เอง และเก็บ private blob ซึ่งเปิดผ่าน authenticated media route เท่านั้น หากไม่มี credential ระบบยังเก็บ metadata และแสดงสถานะว่าไฟล์ยังไม่ถูกจัดเก็บ

แนะนำ retention 30 วัน และลบผ่าน operator job ตามนโยบายข้อมูลร้าน (automatic purge ยังเป็น known limitation ของ Phase 0)

## Database migrations

`database/001_initial.sql` เป็น baseline ที่ห้ามแก้ `database/002_phase0_line_core.sql` เป็น additive migration และล้าง plaintext `settings.channel_secret/access_token` เดิม

```powershell
npm run db:migrate
npm run db:migrate # ต้อง skip ไฟล์ที่ apply แล้ว
npm run db:test    # ใช้ isolated temporary schemas แล้วลบทิ้งหลังตรวจ
```

## ตรวจสอบ

```powershell
npm run test
npm run lint
npm run typecheck
npm run build
npm run verify
git diff --check
```

Real LINE acceptance ใช้ checklist ใน `docs/PHASE0-UAT.md` ห้ามสรุปว่า Production ผ่านจาก build หรือ mocked tests เท่านั้น

## Known limitations

- Pilot ยังเป็น single admin ไม่มี RBAC/user management
- Cron รายวันไม่พอสำหรับ near-real-time; Production ต้องมี external POST scheduler ทุก 1–5 นาที หรือ Vercel plan ที่รองรับ cron ทุกนาที
- Media automatic retention purge และ quota dashboard ยังไม่มี
- LINE reply/push, profile, Blob และ redelivery ต้องยืนยันด้วยบัญชีจริงใน UAT
- Demo simulator และ rule-based reply ไม่ใช่ Generative AI

ดูรายละเอียดที่ `docs/PHASE0-ARCHITECTURE.md`, `docs/PHASE0-OPERATIONS.md` และ `docs/PHASE0-UAT.md`
