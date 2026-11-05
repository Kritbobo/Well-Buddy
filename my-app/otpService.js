import { API_BASE_URL } from './config';

/**
 * ส่งคำขอ OTP ไปที่อีเมล
 * คืนค่า { success: true } หรือ { success: false, message }
 */
export async function sendOtp(email) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await res.json();

    if (!res.ok) {
      return { success: false, message: data.message || 'ส่งรหัส OTP ไม่สำเร็จ' };
    }
    return { success: true };
  } catch (error) {
    console.log('sendOtp error:', error);
    return { success: false, message: 'เชื่อมต่อ server ไม่ได้ กรุณาลองใหม่' };
  }
}

/**
 * ตรวจสอบรหัส OTP ที่ผู้ใช้กรอก
 * ถ้าถูกต้อง backend จะส่ง resetToken กลับมาด้วย (ต้องเก็บไว้ใช้ตอนเปลี่ยนรหัสผ่านจริง)
 * คืนค่า { success: true, resetToken } หรือ { success: false, message }
 */
export async function verifyOtp(email, otp) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), otp }),
    });
    const data = await res.json();

    if (!res.ok) {
      return { success: false, message: data.message || 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ' };
    }
    return { success: true, resetToken: data.resetToken };
  } catch (error) {
    console.log('verifyOtp error:', error);
    return { success: false, message: 'เชื่อมต่อ server ไม่ได้ กรุณาลองใหม่' };
  }
}

/**
 * ตั้งรหัสผ่านใหม่ (หลังจากยืนยัน OTP แล้ว)
 * ต้องส่ง resetToken ที่ได้จาก verifyOtp กลับไปยืนยันสิทธิ์อีกครั้ง (ไม่ใช่ otp ตัวเดิม)
 * คืนค่า { success: true } หรือ { success: false, message }
 */
export async function resetPasswordWithOtp(email, resetToken, newPassword) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), resetToken, newPassword }),
    });
    const data = await res.json();

    if (!res.ok) {
      return { success: false, message: data.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ' };
    }
    return { success: true };
  } catch (error) {
    console.log('resetPasswordWithOtp error:', error);
    return { success: false, message: 'เชื่อมต่อ server ไม่ได้ กรุณาลองใหม่' };
  }
}