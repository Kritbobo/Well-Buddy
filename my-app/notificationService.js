import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import {
  SCHEDULE, isWaterBehind, waterMessage, mealMessage, summaryMessage,
} from './notificationRules';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForNotificationsAsync() {
  if (!Device.isDevice) return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const res = await Notifications.requestPermissionsAsync();
    status = res.status;
  }
  if (status !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'WellBuddy',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6FB84C',
    });
  }
  return true;
}

/** เวลาวันนี้ตามชั่วโมง/นาทีที่กำหนด */
function todayAt(hour, minute = 0, dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function scheduleAt(date, { title, body }, data = {}) {
  if (date <= new Date()) return null;   // เวลาผ่านไปแล้ว ข้าม
  return Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, data },
    trigger: { type: 'date', date },
  });
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * ตั้งคิวแจ้งเตือนใหม่ทั้งหมดตามสถานะปัจจุบัน
 * เรียกทุกครั้งที่เข้าหน้าแรก / กดเพิ่มน้ำ / บันทึกมื้ออาหาร
 *
 * loggedMeals = { breakfast: true, lunch: false, dinner: false }
 */
export async function syncAllReminders({ water, calories, loggedMeals = {} }) {
  await cancelAllReminders();
  const now = new Date();
  let count = 0;

  // ---- มื้ออาหารวันนี้ — เฉพาะมื้อที่ยังไม่บันทึก ----
  const mealPlan = [
    ['breakfast', SCHEDULE.breakfast],
    ['lunch', SCHEDULE.lunch],
    ['dinner', SCHEDULE.dinner],
  ];

  for (const [meal, time] of mealPlan) {
    if (loggedMeals[meal]) continue;
    const caloriesLeft = Math.max((calories?.target || 0) - (calories?.current || 0), 0);
    const ok = await scheduleAt(
      todayAt(time.hour, time.minute),
      mealMessage(meal, { caloriesLeft }),
      { type: 'meal', meal }
    );
    if (ok) count++;
  }

  // ---- น้ำ — เฉพาะรอบที่คาดว่าจะยังตามไม่ทัน ----
  for (const time of [SCHEDULE.water1, SCHEDULE.water2]) {
    const at = todayAt(time.hour, time.minute);
    if (at <= now) continue;
    // ประเมินด้วยยอดปัจจุบัน ถ้าผู้ใช้ดื่มเพิ่มแล้วเปิดแอป จะถูกคำนวณใหม่
    if (!isWaterBehind(water?.current, water?.target, at)) continue;
    const ok = await scheduleAt(at, waterMessage(water?.current, water?.target, at), { type: 'water' });
    if (ok) count++;
  }

  // ---- สรุปวันนี้ ----
  const ok = await scheduleAt(
    todayAt(SCHEDULE.summary.hour, SCHEDULE.summary.minute),
    summaryMessage({ calories, water }),
    { type: 'summary' }
  );
  if (ok) count++;

  // ---- สำรองพรุ่งนี้ เผื่อผู้ใช้ไม่เปิดแอปเลย ----
  for (const [meal, time] of mealPlan) {
    const ok2 = await scheduleAt(
      todayAt(time.hour, time.minute, 1),
      mealMessage(meal),
      { type: 'meal', meal, fallback: true }
    );
    if (ok2) count++;
  }

  return count;
}

/** ปุ่มทดสอบ — เด้งภายในกี่วินาที */
export async function testNotification({ title, body, seconds = 3, type = 'test' }) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true, data: { type } },
    trigger: { type: 'timeInterval', seconds, repeats: false },
  });
}

/** ของในตู้เย็นใกล้หมดอายุ — เตือน 9 โมงเช้า ล่วงหน้า 2 วัน */
export async function scheduleExpiryReminder(items = []) {
  if (items.length === 0) return 0;
  const at = todayAt(9, 0);
  const names = items.slice(0, 3).map((i) => i.name).join(', ');
  const more = items.length > 3 ? ` และอีก ${items.length - 3} รายการ` : '';
  const ok = await scheduleAt(
    at <= new Date() ? todayAt(9, 0, 1) : at,
    {
      title: 'มีของในตู้เย็นใกล้หมดอายุ',
      body: `${names}${more} กำลังจะหมดอายุภายใน 2 วัน อย่าลืมนำมาทำอาหารนะ`,
    },
    { type: 'expiry' }
  );
  return ok ? 1 : 0;
}

// ============================================================
// ชื่อเดิมที่โค้ดส่วนอื่นยังเรียกอยู่ — ต่อเข้ากฎใหม่ให้
// ไม่ต้องแก้ HomeDashBoard / PantryScreen
// ============================================================

/** ของเดิมส่ง loggedMeals มาอย่างเดียว → ต่อเข้า syncAllReminders */
export async function scheduleMealReminders(loggedMeals = {}) {
  return syncAllReminders({
    water: { current: 0, target: 0 },
    calories: { current: 0, target: 0 },
    loggedMeals,
  });
}

/** ของเดิมส่ง currentMl/targetMl มา → ใช้กฎใหม่ ไม่เตือนทุกชั่วโมงแล้ว */
export async function scheduleWaterReminders({ currentMl = 0, targetMl = 0 } = {}) {
  return syncAllReminders({
    water: { current: currentMl, target: targetMl },
    calories: { current: 0, target: 0 },
    loggedMeals: {},
  });
}

/** ชื่อเดิมของ testNotification */
export async function testImmediateNotification({ title, body, seconds = 3, type = 'test' }) {
  return testNotification({ title, body, seconds, type });
}

/** ของเดิมรับ items ทั้งตู้เย็น + threshold → กรองแล้วส่งต่อ */
export async function scheduleExpiryReminders(items = [], { thresholdDays = 2 } = {}) {
  const limit = new Date();
  limit.setDate(limit.getDate() + thresholdDays);
  limit.setHours(23, 59, 59, 999);

  const soon = items.filter((it) => {
    const raw = it.expiryDate || it.expiry || it.expireAt;
    if (!raw) return false;
    const d = raw?.toDate?.() || new Date(raw);
    return !isNaN(d) && d <= limit;
  });

  return scheduleExpiryReminder(soon);
}