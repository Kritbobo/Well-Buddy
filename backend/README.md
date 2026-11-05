# WellBuddy Backend (OTP Service)

Backend เล็ก ๆ สำหรับ:
1. ส่งรหัส OTP ทางอีเมล (ผ่าน Resend)
2. ตรวจสอบ OTP
3. เปลี่ยนรหัสผ่าน Firebase จริง (ผ่าน Admin SDK)

## วิธีรันทดสอบในเครื่องตัวเอง

```bash
cd wellbuddy-backend
npm install
cp .env.example .env
# แก้ไฟล์ .env ใส่ RESEND_API_KEY และ FIREBASE_SERVICE_ACCOUNT_JSON ให้ครบ
npm start
```

ถ้าสำเร็จจะเห็นข้อความ `WellBuddy backend กำลังทำงานที่ port 3000`

ทดสอบเรียก API ด้วย curl:
```bash
curl -X POST http://localhost:3000/api/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"youremail@example.com"}'
```

## วิธี Deploy ขึ้น Render.com (ฟรี ไม่ต้องผูกบัตร)

1. สร้าง repo บน GitHub แล้ว push โค้ดโฟลเดอร์นี้ขึ้นไป (**อย่า push ไฟล์ .env**)
2. ไปที่ https://render.com สมัครสมาชิก (login ด้วย GitHub ได้เลย)
3. กด "New +" → "Web Service"
4. เลือก repo ที่เพิ่ง push ขึ้นไป
5. ตั้งค่า:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. ในส่วน "Environment Variables" เพิ่ม 2 ตัว:
   - `RESEND_API_KEY` = ค่าที่ได้จาก resend.com
   - `FIREBASE_SERVICE_ACCOUNT_JSON` = เนื้อหาทั้งหมดของไฟล์ JSON (วางทั้งไฟล์เป็น string เดียว)
7. กด "Create Web Service" รอสักครู่จน deploy เสร็จ
8. จะได้ URL ประมาณ `https://wellbuddy-backend.onrender.com` — เก็บ URL นี้ไว้ ต้องใช้ในแอป React Native

⚠️ **หมายเหตุ**: Render free tier จะ "sleep" ถ้าไม่มีคนเรียกนานเกิน 15 นาที ตอนแรกที่เรียกใหม่หลัง sleep จะช้าประมาณ 30-50 วินาที (เป็นเรื่องปกติของแผนฟรี)