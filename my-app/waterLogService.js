import { db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot, increment, serverTimestamp } from 'firebase/firestore';

// key แบบ 'YYYY-MM-DD' ใช้แบ่งข้อมูลรายวัน (เหมือน foodLogService)
export function dateKeyFor(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// dateKey ของ N วันก่อนหน้า (0 = วันนี้)
function dateKeyOffset(daysAgo, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() - daysAgo);
  return dateKeyFor(d);
}

/**
 * คำนวณเป้าน้ำดื่มต่อวัน (ml) จากน้ำหนักตัว + ระดับกิจกรรมในโปรไฟล์
 * สูตร: น้ำหนัก(กก.) x 33 ml เป็นฐาน แล้วบวกเพิ่มตามกิจกรรม
 */
export function computeWaterTarget(profile) {
  const weight = profile?.weight || 60; // ค่ากลางเผื่อไม่มีน้ำหนักในโปรไฟล์
  let target = Math.round(weight * 33);
  if (profile?.activityLevel === 'high') target += 500;
  else if (profile?.activityLevel === 'medium') target += 250;
  return target;
}

/**
 * เพิ่มน้ำดื่ม ml ให้ผู้ใช้ uid สำหรับวันนี้ (สะสมยอดในเอกสารเดียวต่อวัน)
 * เก็บที่ users/{uid}/waterLogs/{dateKey}
 */
export async function addWater(uid, ml = 250) {
  if (!uid) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  const ref = doc(db, 'users', uid, 'waterLogs', dateKeyFor());
  await setDoc(
    ref,
    { ml: increment(ml), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * ฟังยอดน้ำดื่มของวันนี้แบบเรียลไทม์ callback ได้รับตัวเลข ml (ไม่มีข้อมูล = 0)
 * คืนค่าเป็นฟังก์ชัน unsubscribe
 */
export function subscribeTodayWater(uid, callback) {
  if (!uid) return () => {};
  const ref = doc(db, 'users', uid, 'waterLogs', dateKeyFor());
  return onSnapshot(
    ref,
    (snap) => callback(snap.exists() ? snap.data().ml || 0 : 0),
    (err) => {
      console.log('subscribeTodayWater error:', err.message);
      callback(0);
    }
  );
}

/**
 * ดึงยอดน้ำดื่มย้อนหลัง N วัน (default 7 วัน รวมวันนี้) เรียงจากวันเก่าสุด -> วันนี้
 * แต่ละวันเป็นเอกสารเดี่ยวอยู่แล้ว (users/{uid}/waterLogs/{dateKey}) เลยดึงตรงทีละวันได้เลย
 * ไม่ต้องพึ่ง query/index ใดๆ
 * คืนค่า: [{ dateKey, ml }, ...] ยาว N รายการ (วันไหนไม่มีข้อมูล ml = 0)
 */
export async function getWeeklyWater(uid, days = 7) {
  const keys = Array.from({ length: days }, (_, i) => dateKeyOffset(days - 1 - i));

  if (!uid) return keys.map((dateKey) => ({ dateKey, ml: 0 }));

  try {
    const results = await Promise.all(
      keys.map(async (dateKey) => {
        const ref = doc(db, 'users', uid, 'waterLogs', dateKey);
        const snap = await getDoc(ref);
        return { dateKey, ml: snap.exists() ? snap.data().ml || 0 : 0 };
      })
    );
    return results;
  } catch (e) {
    console.log('getWeeklyWater error:', e.message);
    return keys.map((dateKey) => ({ dateKey, ml: 0 }));
  }
}