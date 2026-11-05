import { db } from './firebase';
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { getWeeklyWater, computeWaterTarget } from './waterLogService';

// key แบบ 'YYYY-MM-DD' ใช้แบ่งข้อมูลรายวัน (อิงเวลาเครื่องผู้ใช้)
export function dateKeyFor(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// dateKey ของ N วันก่อนหน้า (0 = วันนี้)
export function dateKeyOffset(daysAgo, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() - daysAgo);
  return dateKeyFor(d);
}

export const MEAL_LABELS = {
  breakfast: 'มื้อเช้า',
  lunch: 'มื้อกลางวัน',
  dinner: 'มื้อเย็น',
  snack: 'มื้อว่าง',
};

export const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

// เดามื้ออาหารจากเวลาปัจจุบัน ใช้ตั้งค่าเริ่มต้นตอนบันทึกจากหน้า Scan / Recipe
export function suggestMealType(date = new Date()) {
  const h = date.getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 20) return 'dinner';
  return 'snack';
}

/**
 * บันทึกอาหาร 1 รายการให้ผู้ใช้ uid
 * entry = { name, calories, protein, carbs, fat, mealType }
 * เก็บที่ users/{uid}/foodLogs/{autoId}
 */
export async function addFoodLog(uid, entry) {
  if (!uid) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  const ref = collection(db, 'users', uid, 'foodLogs');
  return addDoc(ref, {
    name: entry.name || 'ไม่ทราบชื่อ',
    imageUri: entry.imageUri || null,
    calories: Number(entry.calories) || 0,
    protein: Number(entry.protein) || 0,
    carbs: Number(entry.carbs) || 0,
    fat: Number(entry.fat) || 0,
    mealType: MEAL_ORDER.includes(entry.mealType) ? entry.mealType : 'snack',
    dateKey: dateKeyFor(),
    createdAt: serverTimestamp(),
  });
}

/**
 * ลบรายการอาหารตาม logId
 */
export async function deleteFoodLog(uid, logId) {
  if (!uid || !logId) return;
  const ref = doc(db, 'users', uid, 'foodLogs', logId);
  await deleteDoc(ref);
}

/**
 * ฟังข้อมูลมื้ออาหารของ "วันนี้" แบบเรียลไทม์
 * callback จะถูกเรียกทุกครั้งที่ข้อมูลเปลี่ยน พร้อม array ของ log (มี id ติดมา)
 * คืนค่าเป็นฟังก์ชัน unsubscribe — เรียกตอน component unmount
 *
 * หมายเหตุ: query นี้ใช้แค่ where('dateKey', '==', ...) เพียงเงื่อนไขเดียว
 * (ไม่มี orderBy ร่วมกับ where คนละฟิลด์) เพื่อไม่ต้องพึ่ง Firestore composite
 * index เลย — เรียงลำดับตาม createdAt ด้วย JS แทนหลังได้ข้อมูลมาแล้ว
 */
export function subscribeTodayFoodLogs(uid, callback) {
  if (!uid) return () => {};
  const ref = collection(db, 'users', uid, 'foodLogs');
  const q = query(ref, where('dateKey', '==', dateKeyFor()));
  return onSnapshot(
    q,
    (snap) => {
      const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      logs.sort((a, b) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return ta - tb;
      });
      callback(logs);
    },
    (err) => {
      console.log('subscribeTodayFoodLogs error:', err.message);
      callback([]);
    }
  );
}

// รวมยอดแคลอรี่/สารอาหารจาก array ของ log
export function sumNutrition(logs) {
  return logs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories || 0),
      protein: acc.protein + (l.protein || 0),
      carbs: acc.carbs + (l.carbs || 0),
      fat: acc.fat + (l.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

/**
 * ดึงข้อมูลย้อนหลัง N วัน (default 7 วัน รวมวันนี้) แล้วจัดกลุ่มเป็นรายวัน
 * คืนค่า array เรียงจากวันเก่าสุด -> วันนี้ ยาว N รายการ (วันไหนไม่มีข้อมูลจะเป็น 0 หมด)
 * แต่ละรายการ: { dateKey, day: '01', calories, carbs, protein, fat, hasLogs }
 * ใช้ where เงื่อนไขเดียว (dateKey >=) ไม่ต้องพึ่ง composite index
 */
export async function getWeeklyStats(uid, days = 7) {
  const emptyDays = Array.from({ length: days }, (_, i) => {
    const offset = days - 1 - i;
    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() - offset);
    return {
      dateKey: dateKeyFor(dateObj),
      day: String(dateObj.getDate()).padStart(2, '0'),
      calories: 0,
      carbs: 0,
      protein: 0,
      fat: 0,
      hasLogs: false,
    };
  });

  if (!uid) return emptyDays;

  const startKey = dateKeyOffset(days - 1);
  const ref = collection(db, 'users', uid, 'foodLogs');
  const q = query(ref, where('dateKey', '>=', startKey));

  let logs = [];
  try {
    const snap = await getDocs(q);
    logs = snap.docs.map((d) => d.data());
  } catch (e) {
    console.log('getWeeklyStats error:', e.message);
    return emptyDays;
  }

  const byDate = {};
  logs.forEach((l) => {
    if (!byDate[l.dateKey]) byDate[l.dateKey] = [];
    byDate[l.dateKey].push(l);
  });

  return emptyDays.map((d) => {
    const dayLogs = byDate[d.dateKey] || [];
    if (dayLogs.length === 0) return d;
    const totals = sumNutrition(dayLogs);
    return { ...d, ...totals, hasLogs: true };
  });
}

/**
 * ดึงยอดรวมที่กินไปวันนี้ของ uid ใดก็ได้ (ใช้ในหน้าครอบครัว)
 * คืน { calories, protein, carbs, fat }
 */
export async function getTodayTotals(uid) {
  const empty = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  if (!uid) return empty;
  try {
    const ref = collection(db, 'users', uid, 'foodLogs');
    const q = query(ref, where('dateKey', '==', dateKeyFor()));
    const snap = await getDocs(q);
    return sumNutrition(snap.docs.map((d) => d.data()));
  } catch (e) {
    console.log('getTodayTotals error:', e.message);
    return empty;
  }
}

/**
 * ดึงรายการมื้ออาหารวันนี้ของ uid ใดก็ได้ (ใช้ในหน้าครอบครัว)
 */
export async function getTodayLogs(uid) {
  if (!uid) return [];
  try {
    const ref = collection(db, 'users', uid, 'foodLogs');
    const q = query(ref, where('dateKey', '==', dateKeyFor()));
    const snap = await getDocs(q);
    const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    logs.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return ta - tb;
    });
    return logs;
  } catch (e) {
    console.log('getTodayLogs error:', e.message);
    return [];
  }
}

/**
 * ดึง log ของวันใดวันหนึ่ง (dateKey) ของ uid ใดก็ได้ — ใช้ตอนกดแท่งกราฟ 7 วัน
 */
export async function getLogsByDate(uid, dateKey) {
  if (!uid || !dateKey) return [];
  try {
    const ref = collection(db, 'users', uid, 'foodLogs');
    const q = query(ref, where('dateKey', '==', dateKey));
    const snap = await getDocs(q);
    const logs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    logs.sort((a, b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return ta - tb;
    });
    return logs;
  } catch (e) {
    console.log('getLogsByDate error:', e.message);
    return [];
  }
}

/**
 * วิเคราะห์เชิงลึกจากข้อมูลจริงย้อนหลัง N วัน (คำนวณตรง ไม่ใช้ AI)
 * คืน { hasData, cards, summary }
 * แต่ละ card: { icon, gradient:[เข้ม,อ่อน], accent, title, desc, detail, tips[] }
 */
export async function getInsights(uid, profile, days = 7) {
  const week = await getWeeklyStats(uid, days);
  const withData = week.filter((d) => d.hasLogs);
  if (withData.length === 0) return { hasData: false, cards: [], summary: null };

  const avg = (k) => withData.reduce((s, d) => s + (d[k] || 0), 0) / withData.length;
  const avgCal = avg('calories'), avgCarb = avg('carbs'), avgPro = avg('protein'), avgFat = avg('fat');
  const targetCal = profile?.calories || 0;
  const cards = [];

  // gradient ไล่จากเข้ม (บนซ้าย) → อ่อน (ล่างขวา)
  const PINK = ['#F8BBD0', '#FCE4EC'];
  const YELLOW = ['#FFF176', '#FFFDE7'];
  const PURPLE = ['#B39DDB', '#EDE7F6'];
  const BLUE = ['#81D4FA', '#E1F5FE'];
  const LGREEN = ['#AED581', '#F1F8E9'];
  const ORANGE = ['#FFB74D', '#FFF3E0'];

  // a) แคลอรี่เทียบเป้า (ชมพู)
  if (targetCal) {
    const diff = avgCal - targetCal;
    if (Math.abs(diff) <= targetCal * 0.15)
      cards.push({
        icon: 'checkmark-circle', gradient: PINK, accent: '#C2185B', title: 'แคลอรี่คงที่ดี',
        desc: `กินเฉลี่ย ${Math.round(avgCal)} kcal/วัน ใกล้เป้า ${targetCal} kcal`,
        detail: 'การกินพลังงานใกล้เคียงเป้าอย่างสม่ำเสมอช่วยให้ร่างกายปรับสมดุลได้ดี ความคืบหน้าตามเป้าหมายจะต่อเนื่อง ไม่เหวี่ยงขึ้นลง',
        tips: ['รักษาแพทเทิร์นการกินแบบนี้ต่อไป', 'กระจายพลังงานให้ครบทั้ง 3 มื้อ', 'จับตาดูวันที่กินเกินหรือน้อยเป็นพิเศษ'],
      });
    else if (diff < 0)
      cards.push({
        icon: 'trending-down', gradient: PINK, accent: '#C2185B', title: 'กินน้อยกว่าเป้า',
        desc: `เฉลี่ย ${Math.round(avgCal)} kcal/วัน ต่ำกว่าเป้า ${Math.round(Math.abs(diff))} kcal`,
        detail: 'การกินต่ำกว่าเป้าต่อเนื่องอาจทำให้พลังงานไม่พอ อ่อนเพลียระหว่างวัน และถ้าเป้าหมายคือเพิ่มน้ำหนักหรือสร้างกล้ามเนื้อ น้ำหนักจะไม่ขึ้นตามที่ตั้งใจไว้',
        tips: ['เพิ่มมื้อว่าง เช่น นม ถั่ว', 'เลือกอาหารพลังงานสูงมีประโยชน์', 'อย่าอดมื้อเช้า'],
      });
    else
      cards.push({
        icon: 'trending-up', gradient: PINK, accent: '#C2185B', title: 'กินเกินเป้า',
        desc: `เฉลี่ย ${Math.round(avgCal)} kcal/วัน เกินเป้า ${Math.round(diff)} kcal`,
        detail: 'พลังงานส่วนเกินที่สะสมทุกวันจะกลายเป็นน้ำหนักที่เพิ่มขึ้น โดยเฉพาะถ้าเป้าหมายคือลดหรือคุมน้ำหนัก ควรคุมปริมาณของทอดและของหวานเป็นพิเศษ',
        tips: ['ลดของทอดและของหวานลง', 'เพิ่มผักให้อิ่มโดยแคลอรี่ไม่พุ่ง', 'ดื่มน้ำก่อนมื้อช่วยลดความหิว'],
      });
  }

  // b+c) สัดส่วนมาโคร (ไขมัน = เหลือง / โปรตีน = ม่วง)
  const macroCal = avgCarb * 4 + avgPro * 4 + avgFat * 9;
  if (macroCal > 0) {
    const fatPct = Math.round((avgFat * 9 / macroCal) * 100);
    const proPct = Math.round((avgPro * 4 / macroCal) * 100);
    if (fatPct > 30) cards.push({
      icon: 'water', gradient: YELLOW, accent: '#F9A825', title: 'ไขมันค่อนข้างสูง',
      desc: `ไขมัน ${fatPct}% ของแคลอรี่ (แนะนำ 20-30%)`,
      detail: 'ไขมันให้พลังงานสูงถึง 9 kcal/กรัม การกินเกินสัดส่วนจะดันพลังงานรวมให้สูงและสะสมเป็นไขมันส่วนเกิน ระยะยาวเสี่ยงไขมันในเลือดสูง',
      tips: ['เลี่ยงของทอด ใช้ต้ม/นึ่ง/ย่าง', 'ลดกะทิ เนย ครีม', 'เลือกไขมันดี อะโวคาโด ถั่ว'],
    });
    if (proPct < 15) cards.push({
      icon: 'barbell', gradient: PURPLE, accent: '#5E35B1', title: 'โปรตีนน้อยไป',
      desc: `โปรตีน ${proPct}% ของแคลอรี่`,
      detail: 'โปรตีนช่วยซ่อมแซมและสร้างกล้ามเนื้อ ทำให้อิ่มนาน ถ้าได้รับน้อยไปกล้ามเนื้ออาจลดลง ฟื้นตัวช้า และหิวบ่อยขึ้นระหว่างวัน',
      tips: ['เพิ่มไข่ อกไก่ ปลา เต้าหู้ทุกมื้อ', 'นม/โยเกิร์ตเป็นมื้อว่างก็ช่วยได้', 'กระจายโปรตีนทุกมื้อ อย่ากระจุกมื้อเดียว'],
    });
  }

  // d) ดื่มน้ำน้อยไป (ฟ้า) — เทียบ getWeeklyWater กับ computeWaterTarget (กันพังด้วย try/catch)
  try {
    const weekWater = await getWeeklyWater(uid, days);
    const daysWithWater = weekWater.filter((w) => (w.ml || 0) > 0);
    if (daysWithWater.length > 0) {
      const avgWater = Math.round(daysWithWater.reduce((s, w) => s + (w.ml || 0), 0) / daysWithWater.length);
      const waterTarget = computeWaterTarget(profile);
      if (waterTarget && avgWater < waterTarget) {
        const pctBelow = Math.round((1 - avgWater / waterTarget) * 100);
        cards.push({
          icon: 'water', gradient: BLUE, accent: '#0288D1', title: 'ดื่มน้ำน้อยไป',
          desc: `ดื่มน้ำเฉลี่ย ${avgWater} ml/วัน ต่ำกว่าเป้า ${pctBelow}%`,
          detail: 'น้ำช่วยระบบเผาผลาญ การย่อย และควบคุมอุณหภูมิร่างกาย ดื่มไม่พอทำให้อ่อนเพลีย สมาธิลด และบางครั้งร่างกายสับสนระหว่างหิวกับกระหาย',
          tips: ['พกขวดน้ำ', 'ดื่มก่อนมื้ออาหาร', 'ตั้งเตือนทุก 1-2 ชม.'],
        });
      }
    }
  } catch (e) {
    console.log('water insight error:', e.message);
  }

  // e) ความสม่ำเสมอ (เขียวอ่อน)
  if (withData.length < days)
    cards.push({
      icon: 'calendar', gradient: LGREEN, accent: '#689F38', title: 'บันทึกไม่สม่ำเสมอ',
      desc: `บันทึก ${withData.length} จาก ${days} วัน`,
      detail: 'ยิ่งบันทึกครบทุกวัน การวิเคราะห์ยิ่งแม่นยำ และคุณจะเห็นภาพรวมพฤติกรรมการกินที่แท้จริง ปรับตัวได้ตรงจุดขึ้น',
      tips: ['ถ่ายรูปอาหารทันทีก่อนกิน', 'ตั้งเตือนบันทึกหลังมื้ออาหาร', 'บันทึกแม้เป็นมื้อว่างเล็กๆ'],
    });

  // f) วันที่ดีที่สุด (ส้ม)
  if (targetCal) {
    let best = withData[0];
    withData.forEach((d) => { if (Math.abs(d.calories - targetCal) < Math.abs(best.calories - targetCal)) best = d; });
    cards.push({
      icon: 'star', gradient: ORANGE, accent: '#F57C00', title: 'วันที่ดีที่สุด',
      desc: `วันที่ ${best.day} กินได้ ${Math.round(best.calories)} kcal ใกล้เป้าที่สุด`,
      detail: 'วันนี้คุณกินใกล้เป้าที่สุดในรอบสัปดาห์ เป็นหลักฐานว่าคุณทำได้จริง ลองนึกดูว่าวันนั้นกินอะไร แล้วนำแพทเทิร์นมาใช้กับวันอื่น',
      tips: ['จดจำเมนูของวันที่ทำได้ดี', 'ทำซ้ำแพทเทิร์นการกินวันนั้น', 'ตั้งเป้าให้มีวันแบบนี้บ่อยขึ้น'],
    });
  }

  const summary = {
    daysTracked: withData.length,
    totalDays: days,
    avgCalories: Math.round(avgCal),
    targetCalories: targetCal,
  };
  return { hasData: true, cards, summary };
}