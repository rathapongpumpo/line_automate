# Phase 0 Operations

## Deploy checklist

1. ตั้ง environment variables โดยไม่พิมพ์ค่าใน log
2. รัน `npm run db:migrate`; ห้ามใช้ `db push` หรือแก้ `001_initial.sql`
3. ตั้ง `CRON_SECRET`; Vercel Cron เรียก `GET /api/jobs/worker` พร้อม Bearer นี้ตาม `vercel.json`
4. สำหรับ retry ทุก 1–5 นาที ตั้ง external scheduler ให้ `POST /api/jobs/worker` พร้อม Bearer `INTERNAL_JOB_SECRET`
5. เปิด LINE webhook/redelivery และกด Verify
6. ตรวจ Settings connection health และคิว Retry/Dead-letter
7. รัน Real LINE UAT

Vercel Cron ใน repository ตั้ง `0 0 * * *` (UTC) เป็น safety net ที่ใช้ได้กับ Hobby จริง แผน Hobby รองรับถี่สุดวันละครั้งและอาจคลาดเคลื่อนภายในชั่วโมง จึงห้ามพึ่ง cron นี้สำหรับ latency ของแชต หากใช้ Pro/Enterprise สามารถเปลี่ยนเป็น `* * * * *`; Vercel Cron ไม่ retry invocation ที่ล้มเหลว จึงต้องอาศัย durable job/reclaim และ external scheduler ตามความต้องการ

## Failure handling

- `429` และ `5xx`: retryable; เคารพ `Retry-After` และใช้ exponential backoff+jitter
- permanent `4xx`: dead-letter พร้อม safe error code; ไม่เก็บ response body/Authorization
- profile failure: customer ยังถูกสร้างและมี `PROFILE_SYNC` job
- media storage missing: metadata ยังคงอยู่; operator เห็นว่า storage ไม่พร้อม
- recipient unfollowed: outbound ถูกบล็อกด้วย `RECIPIENT_UNAVAILABLE`

## Troubleshooting

- `401 Invalid signature`: ตรวจ Channel Secret, raw-body proxy mutation และ channel ให้ตรงกัน
- LINE health configured แต่ disconnected: ตรวจ token scope/expiry โดย rotate token ใน LINE Developers Console
- งานค้าง `RETRY`: ตรวจ Vercel Cron/`CRON_SECRET` และ external scheduler/`INTERNAL_JOB_SECRET`
- worker ตอบ `401`: secret หายหรือไม่ตรง ระบบตั้งใจ fail-closed; ห้าม bypass auth
- งาน `DEAD`: เปิด Settings ดูชนิดงาน/error code จากนั้นแก้ configuration ก่อน retry

ก่อน Production acceptance ต้อง rotate LINE Channel Secret, Channel Access Token, Neon password และ `AUTH_SECRET` เนื่องจาก credential เคยถูกส่งผ่านบทสนทนา ห้ามบันทึกค่าใหม่ลงฐานข้อมูลหรือ source control
