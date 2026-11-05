import { db } from './firebase';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc,
  query, where, getDocs, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { getTodayTotals } from './foodLogService';
import { dateKeyFor, computeWaterTarget } from './waterLogService';

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * ดึงรหัส ID ส่วนตัวของ user (ไว้ให้คนอื่นใช้ตอนจะเพิ่มเป็นสมาชิกครอบครัว)
 * - ถ้า user มี personalCode อยู่แล้วใน Firestore -> คืนค่าเดิมเสมอ ไม่สุ่มใหม่
 *   (สำคัญ: ต้องคงที่ตลอดไป ไม่ว่าจะเรียกกี่ครั้งหรือ login ใหม่กี่รอบก็ตาม)
 * - ถ้ายังไม่เคยมี -> สุ่มรหัส 6 ตัวใหม่ 1 ครั้ง พร้อมกันชนกับรหัสของคนอื่นที่มีอยู่แล้ว
 *   แล้วบันทึกลง users/{uid}.personalCode แบบถาวร
 */
export async function getOrCreatePersonalCode(uid) {
  if (!uid) return null;
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const existingCode = userSnap.data()?.personalCode;

    if (existingCode) {
      return existingCode;
    }

    // ยังไม่เคยมีรหัส — สุ่มใหม่ พร้อมเช็คว่าไม่ชนกับของคนอื่น (ลองใหม่ได้สูงสุด 5 ครั้ง)
    let code = genCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const dupQuery = query(collection(db, 'users'), where('personalCode', '==', code));
      const dupSnap = await getDocs(dupQuery);
      if (dupSnap.empty) break; // ไม่ชนกับใคร ใช้ได้เลย
      code = genCode(); // ชนกันพอดี (โอกาสน้อยมาก) สุ่มใหม่อีกรอบ
    }

    // ใช้ setDoc + merge แทน updateDoc เผื่อ document ของ user ยังไม่เคยถูกสร้างมาก่อน
    await setDoc(userRef, { personalCode: code }, { merge: true });
    return code;
  } catch (error) {
    console.log('getOrCreatePersonalCode error:', error);
    return null;
  }
}

/**
 * สร้างครอบครัวใหม่ — เพิ่ม familyId เข้า array familyIds ของ user (ไม่ทับของเก่า)
 */
export async function createFamily(uid, familyName) {
  try {
    const code = genCode();
    const familyId = `fam_${code}`;
    await setDoc(doc(db, 'families', familyId), {
      name: familyName || 'ครอบครัวของฉัน',
      inviteCode: code,
      ownerUid: uid,
      members: [uid],
      createdAt: Date.now(),
    });
    // arrayUnion = เพิ่มเข้า array กันซ้ำ (ถ้ายังไม่มี field นี้ Firestore สร้างให้เอง)
    await updateDoc(doc(db, 'users', uid), { familyIds: arrayUnion(familyId) });
    return { success: true, familyId, code };
  } catch (error) {
    console.log('createFamily error:', error);
    return { success: false, message: 'สร้างครอบครัวไม่สำเร็จ' };
  }
}

/**
 * เข้าร่วมด้วยรหัสเชิญ
 */
export async function joinFamily(uid, code) {
  try {
    const clean = code.trim().toUpperCase();
    const q = query(collection(db, 'families'), where('inviteCode', '==', clean));
    const snap = await getDocs(q);
    if (snap.empty) {
      return { success: false, message: 'ไม่พบครอบครัวจากรหัสนี้' };
    }
    const famDoc = snap.docs[0];

    // กันเข้าซ้ำกลุ่มเดิม
    if (famDoc.data().members?.includes(uid)) {
      return { success: false, message: 'คุณอยู่ในครอบครัวนี้อยู่แล้ว' };
    }

    await updateDoc(doc(db, 'families', famDoc.id), { members: arrayUnion(uid) });
    await updateDoc(doc(db, 'users', uid), { familyIds: arrayUnion(famDoc.id) });
    return { success: true, familyId: famDoc.id };
  } catch (error) {
    console.log('joinFamily error:', error);
    return { success: false, message: 'เข้าร่วมไม่สำเร็จ' };
  }
}

/**
 * ดึงรายชื่อครอบครัวทั้งหมดที่ user อยู่ (สำหรับหน้า list)
 * คืน [{ id, name, inviteCode, memberCount, isOwner }]
 */
export async function getMyFamilies(uid) {
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    const familyIds = userSnap.data()?.familyIds || [];
    const families = [];
    for (const fid of familyIds) {
      const fSnap = await getDoc(doc(db, 'families', fid));
      if (fSnap.exists()) {
        const d = fSnap.data();
        families.push({
          id: fSnap.id,
          name: d.name,
          inviteCode: d.inviteCode,
          memberCount: d.members?.length || 0,
          isOwner: d.ownerUid === uid,
        });
      }
    }
    return families;
  } catch (error) {
    console.log('getMyFamilies error:', error);
    return [];
  }
}

/**
 * ดึงสมาชิก + โปรไฟล์ของกลุ่มเดียว (read-only) — ใช้ตอนกดเข้าไปในกลุ่ม
 * คืน { family, members:[{uid, name, calories, bmi, ...}] } หรือ null
 */
export async function getFamilyDetail(familyId) {
  try {
    const fSnap = await getDoc(doc(db, 'families', familyId));
    if (!fSnap.exists()) return null;
    const family = { id: fSnap.id, ...fSnap.data() };

    const dayKey = dateKeyFor();
    const members = [];
    for (const memberUid of family.members) {
      const mSnap = await getDoc(doc(db, 'users', memberUid));
      if (mSnap.exists()) {
        const d = mSnap.data();
        // มื้ออาหารกับยอดน้ำวันนี้ดึงพร้อมกัน
        const [eaten, wSnap] = await Promise.all([
          getTodayTotals(memberUid),
          getDoc(doc(db, 'users', memberUid, 'waterLogs', dayKey)),
        ]);
        members.push({
          uid: memberUid,
          name: d.name || 'ไม่ระบุชื่อ',
          photoURL: d.photoURL || null,
          age: d.age || null,
          calories: d.calories || null,
          carb: d.carb || null,
          protein: d.protein || null,
          fat: d.fat || null,
          bmi: d.bmi || null,
          bmiCategory: d.bmiCategory || null,
          bmiLabel: d.bmiLabel || null,
          goal: d.goal || null,
          eaten,
          // ยอดน้ำวันนี้ + เป้าที่คิดจากน้ำหนัก/ระดับกิจกรรมในโปรไฟล์คนนั้น
          water: {
            current: wSnap.exists() ? wSnap.data().ml || 0 : 0,
            target: computeWaterTarget(d),
          },
          isOwner: memberUid === family.ownerUid,
        });
      }
    }
    return { family, members };
  } catch (error) {
    console.log('getFamilyDetail error:', error);
    return null;
  }
}

// ============================================================
// ข้อความเตือนระหว่างคนในครอบครัว (nudge)
// เขียนลงกล่องกลางของครอบครัว ไม่เขียนตรงเข้ากล่องแจ้งเตือนของผู้รับ
// (กฎ Firestore ไม่ให้เขียนข้ามบัญชี) ฝั่งผู้รับจะมาหยิบเองตอนเปิดหน้าแจ้งเตือน
// ============================================================

/** ส่งข้อความเตือนให้สมาชิกคนหนึ่ง — คืน { success } ห้าม throw */
export async function sendNudge(familyId, { fromUid, fromName, toUid, text, fromPhoto = null }) {
  try {
    if (!familyId || !fromUid || !toUid) {
      return { success: false, message: 'ข้อมูลไม่ครบ ส่งไม่ได้' };
    }
    const body = String(text || '').trim().slice(0, 200); // กฎ Firestore บล็อกที่ 200 ตัว
    if (!body) return { success: false, message: 'ยังไม่ได้พิมพ์ข้อความ' };

    // file:// เป็น path ในเครื่องคนส่ง เครื่องคนรับเปิดไม่ได้ เก็บเป็น null ไปเลย
    const photo = fromPhoto && !String(fromPhoto).startsWith('file://') ? fromPhoto : null;

    await addDoc(collection(db, 'families', familyId, 'nudges'), {
      fromUid,
      fromName: fromName || '',
      fromPhoto: photo,
      toUid,
      text: body,
      createdAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.log('sendNudge error:', error);
    return { success: false, message: 'ส่งข้อความไม่สำเร็จ' };
  }
}

/** อ่านข้อความที่ส่งถึง toUid ในครอบครัวนี้ — พังก็คืน [] ห้าม throw */
export async function fetchNudgesFor(familyId, toUid) {
  try {
    if (!familyId || !toUid) return [];
    const snap = await getDocs(
      query(collection(db, 'families', familyId, 'nudges'), where('toUid', '==', toUid))
    );
    return snap.docs.map((d) => {
      const n = d.data();
      return {
        id: d.id,
        fromUid: n.fromUid,
        fromName: n.fromName,
        fromPhoto: n.fromPhoto || null,
        text: n.text,
        createdAt: n.createdAt?.toDate?.() || n.createdAt || null,
      };
    });
  } catch (error) {
    console.log('fetchNudgesFor error:', error);
    return [];
  }
}

// ============================================================
// ออกจากกลุ่ม / ลบกลุ่ม
// หน้าจอเรียกตรง ๆ แล้วเช็ค res.success เอง ทั้งสองตัวจึงห้าม throw เด็ดขาด
// ข้อความใน message เป็นไทย เพราะหน้าจอเอาไปโชว์ตรง ๆ (เหมือน createFamily/joinFamily)
// ============================================================

/**
 * ออกจากครอบครัว — เอาตัวเองออกจากทั้ง 2 ฝั่ง (members ของกลุ่ม และ familyIds ของเรา)
 * เจ้าของกลุ่มออกไม่ได้ ต้องลบกลุ่มแทน ไม่งั้นกลุ่มจะไม่มีเจ้าของแล้วไม่มีใครลบได้อีกเลย
 */
export async function leaveFamily(uid, familyId) {
  try {
    const famRef = doc(db, 'families', familyId);
    const fSnap = await getDoc(famRef);
    if (!fSnap.exists()) {
      return { success: false, message: 'ไม่พบครอบครัวนี้' };
    }

    const d = fSnap.data();
    if (!d.members?.includes(uid)) {
      return { success: false, message: 'คุณไม่ได้อยู่ในครอบครัวนี้' };
    }
    if (d.ownerUid === uid) {
      return { success: false, message: 'เจ้าของกลุ่มออกจากกลุ่มไม่ได้ ให้ลบกลุ่มแทน' };
    }

    // arrayRemove = เอาออกจาก array โดยไม่ต้องอ่านมาเขียนทับทั้งก้อน
    await updateDoc(famRef, { members: arrayRemove(uid) });
    await updateDoc(doc(db, 'users', uid), { familyIds: arrayRemove(familyId) });

    // familySeen จำรายชื่อสมาชิกที่เคยเห็นไว้ ถ้าไม่ลบทิ้ง วันหลังกลับเข้ากลุ่มใหม่
    // จะไม่ขึ้นแจ้งเตือน "สมาชิกใหม่" อีกเลย — ลบไม่ได้ก็ช่างมัน อย่าให้ทั้งฟังก์ชันพัง
    try {
      await deleteDoc(doc(db, 'users', uid, 'familySeen', familyId));
    } catch (e) {
      console.log('leaveFamily familySeen error:', e);
    }

    return { success: true };
  } catch (error) {
    console.log('leaveFamily error:', error);
    return { success: false, message: 'ออกจากครอบครัวไม่สำเร็จ' };
  }
}

/**
 * ลบครอบครัวทั้งกลุ่ม (เจ้าของเท่านั้น)
 * ลำดับสำคัญมาก: เอกสาร families/{id} ต้องลบเป็นขั้นสุดท้ายเสมอ
 * เพราะกฎ Firestore เช็คสิทธิ์ nudges จาก members ในเอกสารนี้
 */
export async function deleteFamily(uid, familyId) {
  try {
    const famRef = doc(db, 'families', familyId);
    const fSnap = await getDoc(famRef);
    if (!fSnap.exists()) {
      return { success: false, message: 'ไม่พบครอบครัวนี้' };
    }

    const d = fSnap.data();
    if (d.ownerUid !== uid) {
      return { success: false, message: 'เฉพาะเจ้าของกลุ่มเท่านั้นที่ลบได้' };
    }

    // ถอด familyId ออกจากทุกคนพร้อมกัน ใครอัปเดตไม่ได้ก็ข้าม ไม่ล้มทั้งกระบวนการ
    // (กฎให้แก้ได้แค่บัญชีตัวเอง บัญชีคนอื่นจะยังจำรหัสกลุ่มไว้ แต่หน้าครอบครัวข้ามกลุ่มที่ไม่มีแล้วให้เอง)
    const members = d.members || [];
    await Promise.all(
      members.map(async (memberUid) => {
        try {
          await updateDoc(doc(db, 'users', memberUid), { familyIds: arrayRemove(familyId) });
        } catch (e) {
          console.log('deleteFamily member error:', memberUid, e.message);
        }
      })
    );

    // เก็บกวาดข้อความเตือนในกล่องกลางก่อน ตอนนี้เอกสารกลุ่มยังอยู่ กฎยังผ่าน
    // ลบทีละอัน ใครลบไม่ได้ก็ข้าม (กฎให้ลบได้เฉพาะข้อความที่ส่งถึงตัวเอง)
    try {
      const nudgeSnap = await getDocs(collection(db, 'families', familyId, 'nudges'));
      await Promise.all(nudgeSnap.docs.map((n) => deleteDoc(n.ref).catch(() => {})));
    } catch (e) {
      console.log('deleteFamily nudges error:', e);
    }

    // ขั้นสุดท้ายจริง ๆ
    await deleteDoc(famRef);
    return { success: true };
  } catch (error) {
    console.log('deleteFamily error:', error);
    return { success: false, message: 'ลบครอบครัวไม่สำเร็จ' };
  }
}