require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// Endpoint สำหรับ "ปลุก" เซิร์ฟเวอร์ล่วงหน้า (แก้ปัญหา Render free tier หลับแล้วตื่นช้า)
// แอปจะยิงมาที่นี่ทันทีที่เข้าหน้าที่เกี่ยวข้อง เพื่อให้ server ตื่นรอไว้ก่อน
// ─────────────────────────────────────────────
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok' });
});

// ─────────────────────────────────────────────
// 1) ตั้งค่า Firebase Admin SDK
//    ต้องตั้งค่า environment variable ชื่อ FIREBASE_SERVICE_ACCOUNT_JSON
//    เป็นเนื้อหาทั้งหมดของไฟล์ service account key (แบบ JSON string)
// ─────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 2) ตั้งค่าระบบส่งอีเมล (Resend + Brevo Fallback)
// ─────────────────────────────────────────────
async function sendOtpEmail(toEmail, code) {
  const htmlContent = `
    <div style="font-family: sans-serif; text-align: center; padding: 28px; background: #f8fafc; border-radius: 16px;">
      <h2 style="color: #6FB84C; margin-bottom: 6px;">WellBuddy</h2>
      <p style="color: #475569; font-size: 15px; margin-bottom: 4px;">รหัสยืนยัน OTP สำหรับเข้าใช้งาน / รีเซ็ตรหัสผ่าน</p>
      <p style="color: #64748b; font-size: 14px;">รหัสยืนยัน OTP ของคุณคือ</p>
      <div style="display: inline-block; background: #ffffff; border: 2px dashed #6FB84C; padding: 14px 28px; border-radius: 12px; margin: 16px 0;">
        <span style="font-size: 34px; font-weight: bold; letter-spacing: 8px; color: #1e293b;">${code}</span>
      </div>
      <p style="color: #94a3b8; font-size: 13px;">รหัสนี้จะหมดอายุภายใน 5 นาที</p>
    </div>
  `;

  // 1) ส่งผ่าน Resend ก่อน (เสถียร ไม่ติดปัญหา IP Whitelist)
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'WellBuddy <onboarding@resend.dev>',
          to: [toEmail],
          subject: 'รหัสยืนยัน OTP สำหรับ WellBuddy',
          html: htmlContent,
        }),
      });
      if (res.ok) {
        return await res.json();
      }
      const errText = await res.text();
      console.warn('Resend send warning:', errText);
    } catch (e) {
      console.warn('Resend fetch failed:', e.message);
    }
  }

  // 2) สำรอง: ส่งผ่าน Brevo หาก Resend ไม่พร้อม
  if (process.env.BREVO_API_KEY) {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: 'WellBuddy', email: process.env.BREVO_SENDER_EMAIL || 'noeylovecatholy@gmail.com' },
        to: [{ email: toEmail }],
        subject: 'รหัสยืนยัน OTP สำหรับ WellBuddy',
        htmlContent: htmlContent,
      }),
    });

    if (response.ok) {
      return await response.json();
    }
    const errorBody = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${errorBody}`);
  }

  throw new Error('ไม่พบคีย์สำหรับส่งอีเมล (Resend/Brevo)');
}

// ─────────────────────────────────────────────
// 3) ที่เก็บ OTP ชั่วคราว (เก็บใน memory)
//    โครงสร้าง: { "someone@email.com": { code, expiresAt, verified, resetToken } }
//    ข้อจำกัด: ถ้าเซิร์ฟเวอร์ restart ข้อมูลจะหายหมด (ยอมรับได้สำหรับแอปเล็กๆ)
// ─────────────────────────────────────────────
const otpStore = {};

function generateOtp() {
  return Math.floor(10000 + Math.random() * 90000).toString(); // เลข 5 หลัก
}

function generateToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ตรวจสอบ Firebase ID Token จาก Authorization header แล้วคืนค่า uid ที่ยืนยันแล้ว
// ปลอดภัยกว่าการรับ uid ตรง ๆ จาก body เพราะ client ปลอมแปลง uid คนอื่นไม่ได้
async function verifyIdTokenFromHeader(req) {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    return null;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.uid;
  } catch (error) {
    console.error('verifyIdToken error:', error.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// API 1: ขอรหัส OTP — ส่งอีเมลไปหาผู้ใช้
// ─────────────────────────────────────────────
app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุอีเมล' });
  }

  try {
    // เช็คก่อนว่าอีเมลนี้มีอยู่ในระบบ Firebase จริงไหม
    const userRec = await admin.auth().getUserByEmail(email);
    const userSnap = await db.collection('users').doc(userRec.uid).get();
    if (userSnap.exists && userSnap.data()?.suspended) {
      return res.status(403).json({ success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' });
    }
  } catch (error) {
    // ไม่บอกตรงๆ ว่า "ไม่พบอีเมลนี้" เพื่อความปลอดภัย (ป้องกันการเดาอีเมลที่มีในระบบ)
    return res.json({ success: true });
  }

  const code = generateOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000; // หมดอายุใน 5 นาที

  otpStore[email] = { code, expiresAt, verified: false };

  try {
    await sendOtpEmail(email, code);
    res.json({ success: true });
  } catch (error) {
    console.error('ส่งอีเมลไม่สำเร็จ:', error);
    res.status(500).json({ success: false, message: 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่' });
  }
});

// ─────────────────────────────────────────────
// API 2: ตรวจสอบรหัส OTP
// ─────────────────────────────────────────────
app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore[email];

  if (!record) {
    return res.status(400).json({ success: false, message: 'กรุณาขอรหัส OTP ใหม่' });
  }
  if (Date.now() > record.expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ success: false, message: 'รหัส OTP หมดอายุแล้ว' });
  }
  if (record.code !== otp) {
    return res.status(400).json({ success: false, message: 'รหัส OTP ไม่ถูกต้อง' });
  }

  // ยืนยันถูกต้อง — สร้าง token ชั่วคราวไว้ใช้ตอนเปลี่ยนรหัสผ่านจริง
  const resetToken = generateToken();
  record.verified = true;
  record.resetToken = resetToken;
  record.tokenExpiresAt = Date.now() + 10 * 60 * 1000; // token ใช้ได้อีก 10 นาที

  res.json({ success: true, resetToken });
});

// ─────────────────────────────────────────────
// API 3: เปลี่ยนรหัสผ่านจริง (ใช้ Admin SDK)
// ─────────────────────────────────────────────
app.post('/api/reset-password', async (req, res) => {
  const { email, resetToken, newPassword } = req.body;
  const record = otpStore[email];

  if (!record || !record.verified || record.resetToken !== resetToken) {
    return res.status(400).json({ success: false, message: 'กรุณายืนยัน OTP ใหม่อีกครั้ง' });
  }
  if (Date.now() > record.tokenExpiresAt) {
    delete otpStore[email];
    return res.status(400).json({ success: false, message: 'เซสชันหมดอายุ กรุณาเริ่มใหม่' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password: newPassword });
    delete otpStore[email]; // ใช้เสร็จแล้ว ลบทิ้ง
    res.json({ success: true });
  } catch (error) {
    console.error('เปลี่ยนรหัสผ่านไม่สำเร็จ:', error);
    res.status(500).json({ success: false, message: 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่' });
  }
});

// ─────────────────────────────────────────────
// API 4: ขอ OTP สำหรับ "เปลี่ยนอีเมล" — ส่งไปที่อีเมลใหม่ (ผ่าน Resend แทน Firebase)
// uid ดึงมาจาก Firebase ID Token ที่ยืนยันแล้ว (Authorization: Bearer <idToken>)
// ไม่รับ uid จาก body ตรงๆ เพื่อกันไม่ให้ client ปลอม uid ของคนอื่น
// ─────────────────────────────────────────────
app.post('/api/send-email-change-otp', async (req, res) => {
  const uid = await verifyIdTokenFromHeader(req);
  if (!uid) {
    return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง' });
  }

  const { newEmail } = req.body;
  if (!newEmail) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ' });
  }

  // เช็คก่อนว่าอีเมลใหม่นี้ถูกใช้ไปแล้วหรือยัง (กันชนกับบัญชีอื่น)
  try {
    await admin.auth().getUserByEmail(newEmail);
    // ถ้า getUserByEmail ไม่ throw แปลว่ามีคนใช้อีเมลนี้อยู่แล้ว
    return res.status(400).json({ success: false, message: 'อีเมลนี้ถูกใช้งานแล้ว' });
  } catch (error) {
    // error แปลว่าไม่มีใครใช้อีเมลนี้ - ตามที่ต้องการ ไปต่อได้
  }

  const code = generateOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  // ใช้ key แยกจาก OTP ลืมรหัสผ่าน (คนละ flow กัน) กันชนกัน
  otpStore[`emailchange:${uid}`] = { code, expiresAt, newEmail, verified: false };

  try {
    await sendOtpEmail(newEmail, code);
    res.json({ success: true });
  } catch (error) {
    console.error('ส่งอีเมลไม่สำเร็จ:', error);
    res.status(500).json({ success: false, message: 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่' });
  }
});

// ─────────────────────────────────────────────
// API 5: ยืนยัน OTP แล้วเปลี่ยนอีเมลจริงทันที (ผ่าน Admin SDK - ไม่ต้องรอกดลิงก์)
// uid ดึงมาจาก Firebase ID Token ที่ยืนยันแล้วเช่นเดียวกับ API 4
// ─────────────────────────────────────────────
app.post('/api/verify-email-change-otp', async (req, res) => {
  const uid = await verifyIdTokenFromHeader(req);
  if (!uid) {
    return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง' });
  }

  const { otp } = req.body;
  const key = `emailchange:${uid}`;
  const record = otpStore[key];

  if (!record) {
    return res.status(400).json({ success: false, message: 'กรุณาขอรหัส OTP ใหม่' });
  }

  // เคยเปลี่ยนอีเมลสำเร็จไปแล้วจากการเรียกครั้งก่อนหน้า (เช่น response หลุดไปก่อนถึง client
  // ตอน Render cold start หรือเน็ตไม่เสถียร แล้ว client เรียก endpoint นี้ซ้ำ/กดยืนยันซ้ำ)
  // ให้ตอบ success กลับไปเลย ไม่ต้องเช็ค OTP ซ้ำ เพื่อป้องกันปัญหา
  // "อีเมลเปลี่ยนสำเร็จจริงแต่แอปขึ้นแจ้งเตือนว่าไม่สำเร็จ"
  if (record.completed) {
    return res.json({ success: true, newEmail: record.newEmail });
  }

  if (Date.now() > record.expiresAt) {
    delete otpStore[key];
    return res.status(400).json({ success: false, message: 'รหัส OTP หมดอายุแล้ว' });
  }
  if (record.code !== otp) {
    return res.status(400).json({ success: false, message: 'รหัส OTP ไม่ถูกต้อง' });
  }

  try {
    // เปลี่ยนอีเมลจริงทันที ไม่ต้องรอกดลิงก์ยืนยันแบบ Firebase เดิม
    await admin.auth().updateUser(uid, { email: record.newEmail });
    const changedEmail = record.newEmail;

    // สำคัญ: admin.auth().updateUser() อัปเดตแค่ฝั่ง Firebase Authentication เท่านั้น
    // Firestore เป็นคนละระบบ ไม่ sync ให้อัตโนมัติ ต้องอัปเดต document เองตรงนี้ด้วย
    // ไม่งั้นอีเมลใน users/{uid} จะค้างเป็นค่าเก่าตลอดไป
    try {
      await db.collection('users').doc(uid).update({ email: changedEmail });
    } catch (firestoreError) {
      // ไม่ทำให้ทั้ง request fail เพราะ Auth เปลี่ยนสำเร็จแล้วซึ่งสำคัญที่สุด
      // แต่ log ไว้ให้เห็นว่า sync Firestore ไม่สำเร็จ ต้องตามไปแก้ที่ document เอง
      console.error(`sync Firestore email ไม่สำเร็จ (uid: ${uid}):`, firestoreError);
    }

    // ทำเครื่องหมายว่าสำเร็จแล้ว แทนที่จะลบทิ้งทันที เผื่อ client เรียกซ้ำเพราะ
    // response ของรอบนี้ส่งไปไม่ถึง (เก็บไว้อีกสักพักแล้วค่อยเคลียร์ทิ้งทีหลัง)
    record.completed = true;
    setTimeout(() => {
      if (otpStore[key] && otpStore[key].completed) {
        delete otpStore[key];
      }
    }, 5 * 60 * 1000); // เก็บไว้ 5 นาทีหลังสำเร็จ ก่อนล้างทิ้งจริง

    res.json({ success: true, newEmail: changedEmail });
  } catch (error) {
    console.error('เปลี่ยนอีเมลไม่สำเร็จ:', error);
    res.status(500).json({ success: false, message: 'เปลี่ยนอีเมลไม่สำเร็จ กรุณาลองใหม่' });
  }
});

// ─────────────────────────────────────────────
// API 6: เช็คสถานะการเปลี่ยนอีเมลล่าสุด — ให้ client ถาม backend ตรงๆ
// ว่า uid นี้เปลี่ยนอีเมลสำเร็จหรือยัง (ใช้แทนการพึ่ง auth.currentUser.reload()
// ฝั่ง client ล้วนๆ ซึ่งอาจพลาดได้ถ้าเน็ตไม่เสถียรตอนนั้นพอดี)
// ─────────────────────────────────────────────
app.get('/api/email-change-status', async (req, res) => {
  const uid = await verifyIdTokenFromHeader(req);
  if (!uid) {
    return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง' });
  }

  const record = otpStore[`emailchange:${uid}`];
  if (record && record.completed) {
    return res.json({ success: true, completed: true, newEmail: record.newEmail });
  }

  return res.json({ success: true, completed: false });
});

// ─────────────────────────────────────────────
// API 7: ระงับ / ปลดระงับ Firebase Auth Account
// ─────────────────────────────────────────────
// เมื่อ disabled: true → Firebase Auth จะบล็อก login ของผู้ใช้คนนั้นทันที
// ผู้ที่เรียก endpoint นี้ต้องเป็น admin (ตรวจสอบผ่าน Firebase ID Token)
app.post('/api/set-user-disabled', async (req, res) => {
  const callerUid = await verifyIdTokenFromHeader(req);
  if (!callerUid) {
    return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง' });
  }

  // ตรวจสอบว่าผู้เรียกเป็น admin จริง
  const adminSnap = await db.collection('admin').doc(callerUid).get();
  if (!adminSnap.exists) {
    return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์ดำเนินการนี้' });
  }

  const { uid, disabled } = req.body;
  if (!uid || typeof disabled !== 'boolean') {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ (uid, disabled)' });
  }

  try {
    await admin.auth().updateUser(uid, { disabled });
    res.json({ success: true, uid, disabled });
  } catch (error) {
    console.error('set-user-disabled error:', error.message);
    res.status(500).json({ success: false, message: 'ดำเนินการไม่สำเร็จ: ' + error.message });
  }
});

// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`WellBuddy backend กำลังทำงานที่ port ${PORT}`);
});

// เพิ่ม timeout ฝั่ง server กันไม่ให้ connection ถูกตัดเร็วเกินไป
// เผื่อกรณี request แรกหลัง cold start ใช้เวลานานกว่าปกติ
// (headersTimeout ต้องมากกว่า keepAliveTimeout เสมอ)
server.keepAliveTimeout = 120000; // 120 วินาที
server.headersTimeout = 125000; // 125 วินาที