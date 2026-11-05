import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updatePassword,
  verifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

// URL ของ backend ที่ deploy บน Render (ใช้สำหรับ flow เปลี่ยนอีเมลผ่าน OTP)
const API_BASE_URL = 'https://wellbuddy-backend.onrender.com';

/**
 * ปลุกเซิร์ฟเวอร์ล่วงหน้า (Render free tier จะหลับถ้าไม่มีคนเรียกนานๆ)
 * เรียกฟังก์ชันนี้ทันทีที่เข้าหน้าที่กำลังจะใช้ backend เร็วๆ นี้
 * ไม่ต้องรอผลลัพธ์ ไม่ต้อง await ก็ได้ (fire-and-forget)
 */
export function wakeBackend() {
  fetch(`${API_BASE_URL}/api/ping`).catch(() => {
    // เงียบไว้เฉยๆ ถ้าปลุกไม่สำเร็จ ไม่กระทบอะไร แค่ทำให้ครั้งถัดไปช้าเหมือนเดิม
  });
}

// แปล error code ของ Firebase เป็นข้อความไทยที่เข้าใจง่าย
function translateError(error) {
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'อีเมลนี้ถูกใช้สมัครแล้ว';
    case 'auth/invalid-email':
      return 'รูปแบบอีเมลไม่ถูกต้อง';
    case 'auth/weak-password':
      return 'รหัสผ่านไม่ปลอดภัยพอ (ต้องอย่างน้อย 6 ตัวอักษร)';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    case 'auth/too-many-requests':
      return 'ลองผิดหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง';
    case 'auth/requires-recent-login':
      return 'กรุณายืนยันตัวตนอีกครั้งก่อนทำรายการนี้';
    case 'auth/operation-not-allowed':
      return 'ระบบไม่อนุญาตให้ทำรายการนี้ กรุณาติดต่อผู้ดูแลระบบ';
    case 'auth/user-disabled':
      return 'บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
    default:
      return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
  }
}

/**
 * สมัครสมาชิกใหม่ด้วยอีเมล/รหัสผ่าน
 * คืนค่า { success: true, user } หรือ { success: false, message }
 */
export async function registerUser(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.log('registerUser error:', error.code);
    return { success: false, message: translateError(error) };
  }
}

/**
 * เข้าสู่ระบบด้วยอีเมล/รหัสผ่าน
 * คืนค่า { success: true, user } หรือ { success: false, message }
 */
export async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );
    const user = userCredential.user;

    // ตรวจสอบว่าบัญชีถูกระงับ (suspended) หรือไม่
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists() && snap.data()?.suspended) {
        await signOut(auth);
        return {
          success: false,
          isSuspended: true,
          message: 'บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ',
        };
      }
    } catch (checkErr) {
      console.log('Check suspended error on login:', checkErr);
    }

    return { success: true, user };
  } catch (error) {
    console.log('loginUser error:', error.code);
    return { success: false, message: translateError(error) };
  }
}

/**
 * ตรวจสอบสถานะบัญชีและบทบาทของผู้ใช้จาก Firestore (users/{uid})
 * คืนค่า { exists, suspended, role }
 */
export async function checkUserStatus(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      return {
        exists: true,
        suspended: !!data.suspended,
        role: data.role || 'user',
      };
    }
    return { exists: false, suspended: false, role: 'user' };
  } catch (error) {
    console.log('checkUserStatus error:', error);
    return { exists: false, suspended: false, role: 'user' };
  }
}

/**
 * เช็ค role ของ user จาก Firestore (users/{uid}) เพื่อแยกว่าเป็น admin หรือ user ทั่วไป
 * ถ้าบัญชีถูกระงับจะคืนค่า 'suspended'
 * ถ้ายังไม่เคยตั้ง role ไว้ (เช่น user สมัครใหม่) จะถือว่าเป็น 'user' โดย default
 * คืนค่า 'admin', 'user', หรือ 'suspended'
 */
export async function getUserRole(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.suspended) {
        return 'suspended';
      }
      if (data.role === 'admin') {
        return 'admin';
      }
    }
    return 'user';
  } catch (error) {
    console.log('getUserRole error:', error);
    return 'user'; // ถ้าเช็คไม่ได้ ให้ถือเป็น user ธรรมดาไว้ก่อน (ปลอดภัยกว่า)
  }
}

/**
 * ส่งอีเมลลิงก์รีเซ็ตรหัสผ่านไปให้ผู้ใช้
 * คืนค่า { success: true } หรือ { success: false, message }
 */
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email.trim());
    return { success: true };
  } catch (error) {
    console.log('resetPassword error:', error.code);
    return { success: false, message: translateError(error) };
  }
}

/**
 * ออกจากระบบ (sign out) ผู้ใช้ปัจจุบัน
 */
export async function logoutUser() {
  try {
    const user = auth.currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          isOnline: false,
          lastSeen: serverTimestamp(),
        });
      } catch (e) {
        // ignore
      }
    }
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.log('logoutUser error:', error);
    return { success: false, message: 'ออกจากระบบไม่สำเร็จ กรุณาลองใหม่' };
  }
}

/**
 * ยืนยันตัวตนซ้ำด้วยรหัสผ่านปัจจุบัน (ใช้ก่อนเปลี่ยนอีเมล/รหัสผ่าน)
 */
export async function reauthenticate(currentPassword) {
  try {
    const user = auth.currentUser;
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    return { success: true };
  } catch (error) {
    console.log('reauthenticate error:', error.code);
    return { success: false, message: translateError(error) };
  }
}

/**
 * ขอเปลี่ยนอีเมล — ใช้ verifyBeforeUpdateEmail (updateEmail ถูกเลิกใช้แล้ว)
 * ⚠️ อีเมลจะยังไม่เปลี่ยนทันที ต้องรอผู้ใช้กดลิงก์ยืนยันในอีเมลใหม่ก่อน
 */
export async function changeEmail(newEmail) {
  try {
    await verifyBeforeUpdateEmail(auth.currentUser, newEmail.trim());
    return { success: true };
  } catch (error) {
    console.log('changeEmail error:', error.code);
    return {
      success: false,
      needsReauth: error.code === 'auth/requires-recent-login',
      message: translateError(error),
    };
  }
}

/**
 * ขอเปลี่ยนอีเมล (เวอร์ชันใหม่ผ่าน backend เอง)
 * ส่งรหัส OTP ไปยังอีเมลใหม่ผ่าน backend ของเรา แทนการใช้ verifyBeforeUpdateEmail ของ Firebase
 * (เพราะผู้ใช้ไม่ได้รับอีเมลยืนยันจาก Firebase)
 * คืนค่า { success: true } หรือ { success: false, message }
 */
export async function sendEmailChangeOtp(newEmail) {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, message: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง' };
    }
    const idToken = await user.getIdToken();

    const response = await fetch(`${API_BASE_URL}/api/send-email-change-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ newEmail: newEmail.trim() }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'ส่งรหัส OTP ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      };
    }

    return { success: true };
  } catch (error) {
    console.log('sendEmailChangeOtp error:', error);
    return { success: false, message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง' };
  }
}

/**
 * ยืนยันรหัส OTP เพื่อทำการเปลี่ยนอีเมลให้เสร็จสมบูรณ์ (ผ่าน backend เอง)
 * เมื่อยืนยันสำเร็จ backend จะเป็นผู้อัปเดตอีเมลใน Firebase ให้ (ผ่าน Admin SDK)
 * คืนค่า { success: true } หรือ { success: false, message }
 */
export async function verifyEmailChangeOtp(newEmail, otp) {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, message: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง' };
    }
    const idToken = await user.getIdToken();

    const response = await fetch(`${API_BASE_URL}/api/verify-email-change-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ newEmail: newEmail.trim(), otp: otp.trim() }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่อีกครั้ง',
      };
    }

    // อีเมลถูกอัปเดตฝั่ง Firebase โดย backend แล้ว รีเฟรช token ของ client ให้ตรงกับข้อมูลล่าสุด
    await user.reload();

    return { success: true };
  } catch (error) {
    console.log('verifyEmailChangeOtp error:', error);
    return { success: false, message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง' };
  }
}

/**
 * เช็คสถานะการเปลี่ยนอีเมลล่าสุดจาก backend โดยตรง
 * ใช้แทน/เสริม auth.currentUser.reload() เวลาที่ verify-email-change-otp
 * ตอบกลับไม่ถึง client (เช่น cold start / เน็ตหลุด) แต่จริงๆ แล้ว
 * backend เปลี่ยนอีเมลสำเร็จไปแล้ว
 * คืนค่า { success: true, completed: boolean, newEmail? }
 */
export async function checkEmailChangeStatus() {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, completed: false };
    }
    const idToken = await user.getIdToken();

    const response = await fetch(`${API_BASE_URL}/api/email-change-status`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { success: false, completed: false };
    }

    return { success: true, completed: !!data.completed, newEmail: data.newEmail };
  } catch (error) {
    console.log('checkEmailChangeStatus error:', error);
    return { success: false, completed: false };
  }
}

/**
 * เปลี่ยนรหัสผ่านของบัญชีปัจจุบัน
 */
export async function changePassword(newPassword) {
  try {
    await updatePassword(auth.currentUser, newPassword);
    return { success: true };
  } catch (error) {
    console.log('changePassword error:', error.code);
    return {
      success: false,
      needsReauth: error.code === 'auth/requires-recent-login',
      message: translateError(error),
    };
  }
}