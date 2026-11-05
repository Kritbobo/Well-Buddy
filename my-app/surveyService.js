import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * เช็คว่า user คนนี้ (ผูกกับ uid) เคยตอบแบบสอบถามจบครบแล้วหรือยัง
 * คืนค่า true/false — ถ้าเช็คไม่ได้ (error) จะคืน false ไว้ก่อน (ให้ถามใหม่ ปลอดภัยกว่า)
 */
export async function checkSurveyExists(uid) {
  try {
    if (!uid) return false;
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;

    const data = snap.data() || {};

    // 1. ตรวจสอบ flag surveyCompleted
    if (data.surveyCompleted === true || data.surveyDone === true || data.isSurveyCompleted === true) {
      return true;
    }

    // 2. ถ้ามีข้อมูลโปรไฟล์ผู้ใช้อยู่ใน Firestore แล้ว (เช่น ชื่อ, แคลอรี่, เพศ, น้ำหนัก, ส่วนสูง, เป้าหมาย)
    // แสดงว่าเคยกรอกข้อมูลไว้แล้ว ไม่ต้องบังคับให้ตอบแบบสอบถามซ้ำ
    const hasProfileData = !!(
      data.name ||
      data.displayName ||
      data.calories ||
      data.weight ||
      data.height ||
      data.gender ||
      data.goal ||
      data.birthDate ||
      data.targetBMI ||
      data.bmi
    );

    if (hasProfileData) {
      // เซฟ flag surveyCompleted: true กลับเข้าไปให้อัตโนมัติ เพื่อให้สมบูรณ์
      setDoc(ref, { surveyCompleted: true }, { merge: true }).catch(() => {});
      return true;
    }

    return false;
  } catch (error) {
    console.log('checkSurveyExists error:', error);
    return false;
  }
}

/**
 * ดึงข้อมูลโปรไฟล์ทั้งหมดของ user (ชื่อ, เพศ, เป้าหมาย, ฯลฯ) จาก Firestore
 * คืนค่า object ข้อมูล หรือ null ถ้าไม่พบ/error
 */
export async function getUserProfile(uid) {
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.log('getUserProfile error:', error);
    return null;
  }
}

/**
 * บันทึกข้อมูลแบบสอบถาม ผูกกับ uid
 * รับ object ข้อมูลแบบยืดหยุ่น (ไม่ fix field ตายตัว) เพราะแต่ละหน้าคำถาม
 * ส่งข้อมูลมาไม่เท่ากัน (เช่น QueActivity ส่ง birthDate, age, height, weight,
 * activityLevel, calories, protein, carb, fat มาด้วย)
 * ใช้ merge:true เผื่อในอนาคตมี field อื่นเพิ่มโดยไม่อยากลบของเดิมทิ้ง
 * คืนค่า { success: true } หรือ { success: false, message }
 */
export async function saveSurveyData(uid, data) {
  try {
    const ref = doc(db, 'users', uid);
    await setDoc(
      ref,
      {
        ...data,
        surveyCompleted: true,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    return { success: true };
  } catch (error) {
    console.log('saveSurveyData error:', error);
    return { success: false, message: 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่' };
  }
}