import { tt } from './appI18n';

// ============================================================
// กฎการแจ้งเตือน — เก็บไว้ที่เดียว ใช้ทั้งเตือนตัวเองและเช็กครอบครัว
// ============================================================

export const WAKE_HOUR = 7;    // เริ่มนับเวลาดื่มน้ำ
export const SLEEP_HOUR = 21;  // หยุดเตือน (ก่อนนอน 2 ชม.)
export const WATER_WINDOW = SLEEP_HOUR - WAKE_HOUR;  // 14 ชั่วโมง
export const BEHIND_RATIO = 0.7;  // ต่ำกว่าที่ควรเกินนี้ = ตามไม่ทัน

// เวลาที่แจ้งเตือนแต่ละอย่าง
export const SCHEDULE = {
  breakfast: { hour: 9,  minute: 30 },
  water1:    { hour: 11, minute: 0  },
  lunch:     { hour: 14, minute: 0  },
  water2:    { hour: 16, minute: 0  },
  dinner:    { hour: 19, minute: 30 },
  summary:   { hour: 21, minute: 0  },
};

/** ถึงตอนนี้ควรดื่มน้ำไปแล้วเท่าไหร่ (ปัดหลัก 50) */
export function expectedWaterBy(targetMl, date = new Date()) {
  if (!targetMl || targetMl <= 0) return 0;
  const h = date.getHours() + date.getMinutes() / 60;
  if (h <= WAKE_HOUR) return 0;
  if (h >= SLEEP_HOUR) return targetMl;
  const ratio = (h - WAKE_HOUR) / WATER_WINDOW;
  return Math.round((targetMl * ratio) / 50) * 50;
}

/** ดื่มน้ำตามไม่ทันหรือยัง */
export function isWaterBehind(currentMl, targetMl, date = new Date()) {
  const expected = expectedWaterBy(targetMl, date);
  if (expected <= 0) return false;
  return (currentMl || 0) < expected * BEHIND_RATIO;
}

/** ใส่ comma หลักพัน — ไม่พึ่ง toLocaleString (Hermes บางเครื่องไม่มี Intl) */
export const fmt = (n) =>
  Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ============================================================
// ข้อความแจ้งเตือน — ของตัวเอง (ไม่ใส่อีโมจิ ให้ UI วาดไอคอนเอง)
// ============================================================

export function waterMessage(currentMl, targetMl, date = new Date()) {
  const expected = expectedWaterBy(targetMl, date);
  const missing = Math.max(expected - (currentMl || 0), 0);
  return {
    title: tt('ยังดื่มน้ำไม่ถึงเป้า'),
    body: tt(
      'ตอนนี้ควรดื่มได้ประมาณ {expected} ml แล้ว คุณดื่มไป {current} ml ขาดอีก {missing} ml',
      { expected: fmt(expected), current: fmt(currentMl), missing: fmt(missing) }
    ),
  };
}

export function mealMessage(meal, { caloriesLeft } = {}) {
  const label = { breakfast: 'มื้อเช้า', lunch: 'มื้อกลางวัน', dinner: 'มื้อเย็น' }[meal];
  const body =
    meal === 'dinner' && caloriesLeft > 0
      ? tt('วันนี้เหลืออีก {n} kcal อย่าลืมกินและบันทึกด้วยนะ', { n: fmt(caloriesLeft) })
      : tt('อย่าลืมกิน{meal}และบันทึกลงแอปด้วยนะ', { meal: tt(label) });
  return { title: tt('ยังไม่ได้บันทึก{meal}', { meal: tt(label) }), body };
}

export function summaryMessage({ calories, water }) {
  const waterLeft = Math.max((water?.target || 0) - (water?.current || 0), 0);
  const tail =
    waterLeft > 0
      ? tt(' ยังขาดน้ำอีก {n} ml ดื่มเพิ่มก่อนนอนได้นะ', { n: fmt(waterLeft) })
      : tt(' วันนี้ดื่มน้ำครบเป้าแล้ว เยี่ยมมาก');
  return {
    title: tt('สรุปวันนี้'),
    body:
      tt('กินไป {eaten} / {target} kcal · น้ำ {water} / {waterTarget} ml', {
        eaten: fmt(calories?.current),
        target: fmt(calories?.target),
        water: fmt(water?.current),
        waterTarget: fmt(water?.target),
      }) + tail,
  };
}

// ============================================================
// ข้อความแจ้งเตือน — ครอบครัว
// ============================================================

export function familyWaterMessage(name, currentMl, targetMl, date = new Date()) {
  const expected = expectedWaterBy(targetMl, date);
  const missing = Math.max(expected - (currentMl || 0), 0);
  return {
    title: tt('{name} ยังดื่มน้ำไม่ถึงเป้า', { name }),
    body: tt(
      'ตอนนี้ควรดื่มได้ประมาณ {expected} ml แล้ว {name} ดื่มไป {current} ml ขาดอีก {missing} ml',
      { expected: fmt(expected), name, current: fmt(currentMl), missing: fmt(missing) }
    ),
  };
}

export function familyMealMessage(name, meal) {
  const label = { breakfast: 'มื้อเช้า', lunch: 'มื้อกลางวัน', dinner: 'มื้อเย็น' }[meal];
  return {
    title: tt('{name} ยังไม่ได้บันทึก{meal}', { name, meal: tt(label) }),
    body: tt('{name} ยังไม่ได้บันทึก{meal}วันนี้ ลองทักไปถามดูไหม', { name, meal: tt(label) }),
  };
}

export function familyOverMessage(name, eaten, target) {
  return {
    title: tt('{name} กินเกินเป้าหมาย', { name }),
    body: tt('{name} กินไป {eaten} kcal เกินเป้าไป {over} kcal แล้ววันนี้', {
      name,
      eaten: fmt(eaten),
      over: fmt(eaten - target),
    }),
  };
}

export function familyJoinMessage(name, familyName) {
  return {
    title: tt('สมาชิกใหม่เข้าร่วมครอบครัว'),
    body: tt('{name} เข้าร่วมครอบครัว "{family}" แล้ว', { name, family: familyName }),
  };
}