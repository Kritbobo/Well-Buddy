import { db } from './firebase';
import { collection, addDoc, getDocs, query, where, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { dateKeyOffset, MEAL_ORDER } from './foodLogService';

// เมนูไทย แยกตามมื้อ — ค่าโภชนาการอิงตารางกรมอนามัย/INMU โดยประมาณ
const MENU = {
  breakfast: [
    { name: 'ข้าวต้มหมู', calories: 320, protein: 18, carbs: 44, fat: 7 },
    { name: 'ไข่เจียวข้าวสวย', calories: 480, protein: 20, carbs: 55, fat: 20 },
    { name: 'โจ๊กหมูใส่ไข่', calories: 350, protein: 19, carbs: 46, fat: 9 },
    { name: 'ปาท่องโก๋ + นมถั่วเหลือง', calories: 420, protein: 11, carbs: 52, fat: 18 },
    { name: 'ข้าวเหนียวหมูปิ้ง 3 ไม้', calories: 540, protein: 24, carbs: 68, fat: 18 },
    { name: 'ขนมปังปิ้ง + ไข่ดาว', calories: 380, protein: 15, carbs: 40, fat: 17 },
    { name: 'ซีเรียลนมสด', calories: 300, protein: 10, carbs: 48, fat: 7 },
  ],
  lunch: [
    { name: 'ข้าวกะเพราหมูสับไข่ดาว', calories: 620, protein: 30, carbs: 66, fat: 25 },
    { name: 'ข้าวมันไก่', calories: 590, protein: 28, carbs: 70, fat: 21 },
    { name: 'ผัดไทยกุ้งสด', calories: 550, protein: 24, carbs: 72, fat: 18 },
    { name: 'ข้าวหมูกรอบ', calories: 680, protein: 26, carbs: 68, fat: 34 },
    { name: 'ก๋วยเตี๋ยวเรือน้ำตก', calories: 380, protein: 22, carbs: 48, fat: 10 },
    { name: 'ข้าวผัดกุ้ง', calories: 560, protein: 23, carbs: 74, fat: 18 },
    { name: 'ส้มตำไก่ย่างข้าวเหนียว', calories: 610, protein: 34, carbs: 68, fat: 20 },
    { name: 'ราดหน้าหมู', calories: 520, protein: 21, carbs: 64, fat: 19 },
  ],
  dinner: [
    { name: 'ต้มยำกุ้งน้ำใส + ข้าวสวย', calories: 450, protein: 28, carbs: 52, fat: 12 },
    { name: 'แกงเขียวหวานไก่ + ข้าวสวย', calories: 580, protein: 25, carbs: 60, fat: 26 },
    { name: 'ปลาทอดน้ำปลา + ข้าวสวย', calories: 520, protein: 32, carbs: 55, fat: 19 },
    { name: 'ผัดผักรวมหมู + ข้าวสวย', calories: 430, protein: 20, carbs: 56, fat: 14 },
    { name: 'สุกี้น้ำรวมมิตร', calories: 390, protein: 26, carbs: 40, fat: 12 },
    { name: 'ข้าวคะน้าหมูกรอบ', calories: 640, protein: 24, carbs: 64, fat: 32 },
    { name: 'ลาบหมู + ข้าวเหนียว', calories: 560, protein: 30, carbs: 62, fat: 21 },
  ],
  snack: [
    { name: 'นมกล่องจืด', calories: 130, protein: 8, carbs: 12, fat: 5 },
    { name: 'กล้วยหอม 1 ผล', calories: 105, protein: 1, carbs: 27, fat: 0 },
    { name: 'โยเกิร์ตรสธรรมชาติ', calories: 150, protein: 9, carbs: 18, fat: 4 },
    { name: 'ขนมปังสังขยา', calories: 260, protein: 6, carbs: 38, fat: 9 },
    { name: 'ชานมไข่มุก', calories: 340, protein: 4, carbs: 62, fat: 9 },
    { name: 'ถั่วอบ 1 กำมือ', calories: 180, protein: 7, carbs: 8, fat: 15 },
    { name: 'ส้ม 2 ผล', calories: 90, protein: 2, carbs: 22, fat: 0 },
  ],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const jitter = (n, pct = 0.12) =>
  Math.max(1, Math.round(n * (1 + (Math.random() * 2 - 1) * pct)));

/**
 * เขียน foodLog 1 รายการ โดย "ระบุ dateKey เองได้"
 * ต่างจาก addFoodLog() ใน foodLogService ที่ล็อกเป็นวันนี้เสมอ
 * ใส่ seeded: true ไว้เพื่อให้ลบทิ้งทีหลังได้
 */
async function writeLogAt(uid, dateKey, entry) {
  const ref = collection(db, 'users', uid, 'foodLogs');
  return addDoc(ref, {
    name: entry.name,
    imageUri: null,                 // ไม่ยัดรูป — ใส่เองทีหลัง
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
    mealType: entry.mealType,
    dateKey,
    createdAt: new Date(),          // ไม่ใช้ serverTimestamp จะได้ย้อนวันได้
    seeded: true,
  });
}

/**
 * สร้างข้อมูลย้อนหลัง days วัน (รวมวันนี้)
 * onProgress(done, total) เรียกทุกวันที่เขียนเสร็จ
 * คืนค่า { days, logs, skipped }
 */
export async function seedFoodLogs(uid, days = 7, onProgress) {
  if (!uid) throw new Error('ยังไม่ได้เข้าสู่ระบบ');

  let logCount = 0;
  let skipped = 0;

  for (let i = days - 1; i >= 0; i--) {
    const dateKey = dateKeyOffset(i);

    // ข้ามวันที่มีข้อมูลอยู่แล้ว กันซ้ำถ้ากดสองรอบ
    const existing = await getDocs(
      query(collection(db, 'users', uid, 'foodLogs'), where('dateKey', '==', dateKey))
    );
    if (!existing.empty) {
      skipped++;
      onProgress?.(days - i, days);
      continue;
    }

    // ทุกวันมี เช้า/กลางวัน/เย็น + มื้อว่าง 60%
    const meals = ['breakfast', 'lunch', 'dinner'];
    if (Math.random() < 0.6) meals.push('snack');

    for (const mealType of meals) {
      const base = pick(MENU[mealType]);
      await writeLogAt(uid, dateKey, {
        name: base.name,
        mealType,
        calories: jitter(base.calories),
        protein: jitter(base.protein),
        carbs: jitter(base.carbs),
        fat: jitter(base.fat),
      });
      logCount++;
    }

    // น้ำดื่ม 1,400–2,600 ml ต่อวัน
    await setDoc(
      doc(db, 'users', uid, 'waterLogs', dateKey),
      { ml: Math.round((1400 + Math.random() * 1200) / 50) * 50, updatedAt: new Date() },
      { merge: true }
    );

    onProgress?.(days - i, days);
  }

  return { days, logs: logCount, skipped };
}

/** ลบเฉพาะข้อมูลที่เจนมา (seeded: true) ของจริงไม่โดน */
export async function clearSeededLogs(uid) {
  if (!uid) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'foodLogs'), where('seeded', '==', true))
  );
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  return snap.size;
}