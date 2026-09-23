# Real LINE UAT

สถานะเริ่มต้น: `BLOCKED_BY_OWNER_SECRET_ROTATION` จนกว่า Owner จะ rotate LINE Channel Secret/Access Token ที่เคยเผยแพร่ ตั้งค่า Production ใหม่ และยืนยันบัญชีทดสอบ ห้ามใช้ credential ชุดเดิมทำ UAT

บันทึกเวลา, LINE user test alias, conversation/message ID และผลที่เห็น โดยไม่ capture token หรือข้อมูลส่วนบุคคลจริง

- [ ] User A follow OA; ชื่อ/รูป profile ปรากฏ
- [ ] ส่งคำถามสินค้า; bot ตอบใน LINE
- [ ] ส่งเบอร์/ความสนใจ; Lead และ notification ปรากฏครั้งเดียว
- [ ] ขอ Admin; conversation เป็น WAITING และ bot หยุด
- [ ] Admin takeover; ข้อความลูกค้าถัดไปไม่ถูก bot ตอบ
- [ ] Admin reply; LINE user ได้รับและ message เป็น SENT
- [ ] จำลอง token/API failure; UI เป็น FAILED และ retry record เดิม
- [ ] Resume Automation; bot กลับมาตอบตาม toggle
- [ ] Close; inbound ถัดไปเปิด conversation ใหม่
- [ ] ส่ง image, video, audio, file, location, sticker; Inbox ไม่พังและ metadata/storage ถูกต้อง
- [ ] Unfollow; outbound ถูกบล็อก
- [ ] ส่ง fixture event เดิม 3 ครั้ง; message/lead/notification ไม่ซ้ำ
- [ ] เปิด/ปิด automation rules ทีละตัว; Demo และ signed webhook decision ตรงกัน
- [ ] ทดสอบ business-hours boundary และช่วงข้ามเที่ยงคืน
- [ ] ตรวจ browser network ไม่มี secret/token และ console errors เป็น 0

Production acceptance เพิ่ม: rotate credentials, deploy สำเร็จ, checklist ผ่านครบ และ monitoring ไม่พบ unhandled/duplicate event
