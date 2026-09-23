# Phase 0 Architecture

## Inbound flow

LINE → `/api/line/webhook` → raw-body signature verification → typed normalization → `webhook_events` + `jobs` transaction → ตอบ `200` → durable worker → customer/profile/conversation/message → automation decision → reply/lead/notification

`webhookEventId`, inbound `line_message_id`, notification `dedupe_key`, lead uniqueness และ job `dedupe_key` ป้องกัน side effect ซ้ำ Event ที่มาถึงผิดลำดับถูกบันทึกแต่ไม่ย้อน conversation state หรือสั่ง bot ตอบ

Next.js `after()` อาจเริ่ม job หลังส่ง response เพื่อลด latency แต่ไม่ใช่ correctness path งานจริงถูก claim แบบ atomic โดย worker; `PROCESSING` ที่ lock ค้างเกิน 5 นาทีถูก reclaim

## Outbound flow

Inbox สร้าง UUID ต่อการกดส่ง → message `QUEUED` → job → atomic claim `SENDING` → LINE Push API → `SENT` หรือ `FAILED` Retry/reclaim ใช้ message record, UUID และ `X-Line-Retry-Key` เดิม เฉพาะ `U_DEMO` เท่านั้นที่จำลอง `SENT`; `DEMO_MODE` และ `settings.demo_mode` ไม่ข้าม LINE API ของลูกค้าจริง Event `standby` ไม่สร้าง outbound record

## Conversation lifecycle

- `AUTO`: bot ตอบตาม rules
- `WAITING`: bot หยุด; รอ Admin
- `ADMIN`: bot หยุด; Admin ส่ง Push Message ได้
- `CLOSED`: inbound ใหม่เปิด conversation ใหม่

Transitions ที่อนุญาต: `AUTO/WAITING → ADMIN`, `ADMIN/WAITING → AUTO`, `AUTO/WAITING/ADMIN → CLOSED` ทุก transition มี internal timeline event และ `conversation_events` audit โดยไม่ Push system message ให้ลูกค้า

## Security boundary

LINE credentials อยู่ใน server environment เท่านั้น Settings API ใช้ strict schema และไม่รับ credential Production auth ไม่มี fallback, cookie เป็น HttpOnly/Secure/SameSite=Lax, login มี database-backed rate limit, mutation route ตรวจ Origin และ response มี baseline security headers
