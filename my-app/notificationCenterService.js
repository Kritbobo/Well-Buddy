import { db } from './firebase';
import {
  collection, doc, addDoc, getDoc, setDoc, getDocs,
  query, where, orderBy, limit, writeBatch,
} from 'firebase/firestore';
import { getMyFamilies, getFamilyDetail, fetchNudgesFor } from './familyService';
import { getTodayLogs, dateKeyFor } from './foodLogService';
import { computeWaterTarget } from './waterLogService';
import {
  SCHEDULE, isWaterBehind, familyWaterMessage, familyMealMessage, familyOverMessage,
} from './notificationRules';
import { tt } from './appI18n';

// ============================================================
// อ่าน/เขียนกล่องแจ้งเตือนของตัวเอง
// ============================================================

export async function pushNotification(uid, { type, title, body, dedupeKey, meta = {} }) {
  if (!uid) return false;
  if (dedupeKey) {
    const dup = await getDocs(
      query(collection(db, 'users', uid, 'notifications'), where('dedupeKey', '==', dedupeKey))
    );
    if (!dup.empty) return false;
  }
  await addDoc(collection(db, 'users', uid, 'notifications'), {
    type, title, body,
    dedupeKey: dedupeKey || null,
    meta, read: false, createdAt: new Date(),
  });
  return true;
}

export async function getNotifications(uid, max = 60) {
  if (!uid) return [];
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(max))
  );
  return snap.docs.map((d) => ({
    id: d.id, ...d.data(),
    createdAt: d.data().createdAt?.toDate?.() || new Date(),
  }));
}

export async function getUnreadCount(uid) {
  if (!uid) return 0;
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'notifications'), where('read', '==', false))
  );
  return snap.size;
}

export async function markAllRead(uid) {
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'notifications'), where('read', '==', false))
  );
  if (snap.empty) return 0;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
  return snap.size;
}

/** ลบแจ้งเตือนทีละรายการ — คืน true ถ้าลบสำเร็จ ห้าม throw ให้ฝั่งเรียกพัง */
export async function deleteNotification(uid, id) {
  if (!uid || !id) return false;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', uid, 'notifications', id));
    await batch.commit();
    return true;
  } catch (e) {
    console.log('deleteNotification error:', e);
    return false;
  }
}

export async function clearAllNotifications(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'notifications'));
  if (snap.empty) return 0;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

// ============================================================
// อ่านน้ำของสมาชิกคนอื่น (read-only)
// ============================================================
async function getWaterOf(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'waterLogs', dateKeyFor()));
    return snap.exists() ? snap.data().ml || 0 : 0;
  } catch {
    return 0;
  }
}

// ============================================================
// สแกนครอบครัว — ใช้กฎเดียวกับของตัวเอง
// เครื่องเราคำนวณเอง เขียนลงบัญชีตัวเองเท่านั้น ไม่แตะบัญชีคนอื่น
// ============================================================
export async function syncFamilyNotifications(uid) {
  if (!uid) return 0;
  const day = dateKeyFor();
  const now = new Date();
  const hour = now.getHours();
  let created = 0;

  const families = await getMyFamilies(uid);
  if (families.length === 0) return 0;

  for (const fam of families) {
    const detail = await getFamilyDetail(fam.id);
    if (!detail) continue;

    // ---- สมาชิกใหม่เข้ากลุ่ม ----
    const seenRef = doc(db, 'users', uid, 'familySeen', fam.id);
    const seenSnap = await getDoc(seenRef);
    const seenUids = seenSnap.exists() ? seenSnap.data().uids || [] : [];

    if (seenSnap.exists()) {
      for (const m of detail.members) {
        if (m.uid === uid || seenUids.includes(m.uid)) continue;
        if (!m.name || m.name === 'ไม่ระบุชื่อ') continue;
        if (await pushNotification(uid, {
          type: 'family-join',
          title: tt('สมาชิกใหม่เข้าร่วมครอบครัว'),
          body: tt('{name} เข้าร่วมครอบครัว "{family}" แล้ว', { name: m.name, family: fam.name }),
          dedupeKey: `join-${fam.id}-${m.uid}`,
          meta: { familyId: fam.id, memberUid: m.uid },
        })) created++;
      }
    }
    await setDoc(seenRef, {
      uids: detail.members.map((m) => m.uid),
      updatedAt: new Date(),
    });

    // ---- เช็กสมาชิกทีละคน ด้วยกฎเดียวกับของเรา ----
    for (const m of detail.members) {
      if (m.uid === uid) continue;

      // ไม่มีชื่อ = ข้อความอ่านไม่รู้เรื่อง ข้ามไปเลย
      if (!m.name || m.name === 'ไม่ระบุชื่อ') continue;

      // น้ำ
      const waterTarget = computeWaterTarget(m);
      const waterNow = await getWaterOf(m.uid);
      const passedWaterCheck =
        hour >= SCHEDULE.water1.hour && isWaterBehind(waterNow, waterTarget, now);

      if (passedWaterCheck) {
        const slot = hour >= SCHEDULE.water2.hour ? 'pm' : 'am';
        const msg = familyWaterMessage(m.name, waterNow, waterTarget, now);
        if (await pushNotification(uid, {
          type: 'family-water', ...msg,
          dedupeKey: `fwater-${day}-${slot}-${m.uid}`,
          meta: { familyId: fam.id, memberUid: m.uid },
        })) created++;
      }

      // มื้ออาหาร
      const logs = await getTodayLogs(m.uid);
      const logged = {};
      logs.forEach((l) => { logged[l.mealType] = true; });

      const mealChecks = [
        ['breakfast', SCHEDULE.breakfast.hour],
        ['lunch', SCHEDULE.lunch.hour],
        ['dinner', SCHEDULE.dinner.hour],
      ];
      for (const [meal, h] of mealChecks) {
        if (hour < h || logged[meal]) continue;
        const msg = familyMealMessage(m.name, meal);
        if (await pushNotification(uid, {
          type: 'family-meal', ...msg,
          dedupeKey: `fmeal-${day}-${meal}-${m.uid}`,
          meta: { familyId: fam.id, memberUid: m.uid },
        })) created++;
      }

      // กินเกินเป้า
      const eaten = m.eaten?.calories || 0;
      const target = m.calories || 0;
      if (target > 0 && eaten > target) {
        const msg = familyOverMessage(m.name, eaten, target);
        if (await pushNotification(uid, {
          type: 'family-over', ...msg,
          dedupeKey: `fover-${day}-${m.uid}`,
          meta: { familyId: fam.id, memberUid: m.uid },
        })) created++;
      }
    }
  }
  return created;
}

// ============================================================
// หยิบข้อความเตือนจากคนในครอบครัวเข้ากล่องตัวเอง
// กล่องกลางอยู่ที่ families/{familyId}/nudges — ฝั่งผู้ส่งเขียนไว้ตรงนั้น
// nudgeSeen จำว่าหยิบไปแล้ว เพราะผู้ใช้กดค้างลบแจ้งเตือนได้
// ถ้าพึ่ง dedupeKey อย่างเดียว ข้อความจะโผล่กลับมาใหม่ทุกครั้งที่เปิดหน้า
// ============================================================
export async function syncNudges(uid) {
  if (!uid) return 0;
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    const familyIds = userSnap.exists() ? userSnap.data().familyIds || [] : [];
    if (familyIds.length === 0) return 0;

    // ทุกครอบครัวยิงพร้อมกัน และในแต่ละครอบครัวก็เช็ก nudgeSeen ของทุกข้อความพร้อมกัน
    const perFamily = await Promise.all(
      familyIds.map(async (familyId) => {
        const nudges = await fetchNudgesFor(familyId, uid);
        if (nudges.length === 0) return 0;

        const done = await Promise.all(
          nudges.map(async (n) => {
            const seenRef = doc(db, 'users', uid, 'nudgeSeen', n.id);
            const seenSnap = await getDoc(seenRef);
            if (seenSnap.exists()) return 0; // หยิบไปแล้ว ข้าม

            const created = await pushNotification(uid, {
              type: 'nudge',
              title: tt('ข้อความจาก {name}', { name: n.fromName }),
              body: n.text,
              dedupeKey: `nudge_${n.id}`,
              meta: { fromUid: n.fromUid, familyId, fromPhoto: n.fromPhoto || null },
            });
            await setDoc(seenRef, { at: new Date() });
            return created ? 1 : 0;
          })
        );
        return done.reduce((sum, x) => sum + x, 0);
      })
    );

    return perFamily.reduce((sum, x) => sum + x, 0);
  } catch (e) {
    console.log('syncNudges error:', e);
    return 0;
  }
}

// ============================================================
// บันทึกแจ้งเตือนของตัวเองลงกล่อง (ให้เห็นย้อนหลังในหน้าแจ้งเตือน)
// ============================================================
export async function logPersonalNotifications(uid, { water, calories, loggedMeals = {} }) {
  if (!uid) return 0;
  const day = dateKeyFor();
  const now = new Date();
  const hour = now.getHours();
  let created = 0;

  const { waterMessage, mealMessage } = require('./notificationRules');

  if (hour >= SCHEDULE.water1.hour && isWaterBehind(water?.current, water?.target, now)) {
    const slot = hour >= SCHEDULE.water2.hour ? 'pm' : 'am';
    if (await pushNotification(uid, {
      type: 'water', ...waterMessage(water?.current, water?.target, now),
      dedupeKey: `water-${day}-${slot}`,
    })) created++;
  }

  const mealChecks = [
    ['breakfast', SCHEDULE.breakfast.hour],
    ['lunch', SCHEDULE.lunch.hour],
    ['dinner', SCHEDULE.dinner.hour],
  ];
  const caloriesLeft = Math.max((calories?.target || 0) - (calories?.current || 0), 0);
  for (const [meal, h] of mealChecks) {
    if (hour < h || loggedMeals[meal]) continue;
    if (await pushNotification(uid, {
      type: 'meal', ...mealMessage(meal, { caloriesLeft }),
      dedupeKey: `meal-${day}-${meal}`,
    })) created++;
  }

  return created;
}