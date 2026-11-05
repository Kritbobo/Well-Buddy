import { db } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

/**
 * คลังรูปวัตถุดิบ (collection 'ingredientPhotos') — เก็บแยกจากเอกสารเมนู
 * อัปโหลดครั้งเดียวต่อ "ชื่อวัตถุดิบ" แล้วใช้ซ้ำได้ทุกเมนูที่มีวัตถุดิบชื่อเดียวกัน
 * ป้องกันไม่ให้เอกสารเมนู (collection 'menus') บวมเกิน limit 1MB ของ Firestore
 * เพราะเมนูหนึ่งอาจมีวัตถุดิบเป็นสิบๆ รายการ
 *
 * doc id = ชื่อวัตถุดิบที่ normalize แล้ว (ตัดช่องว่างหัวท้าย, ตัวพิมพ์เล็ก, ยุบช่องว่างซ้ำ)
 * เพื่อให้ "ไข่ไก่" กับ " ไข่ไก่ " หรือ "Egg" กับ "egg" ถือเป็นวัตถุดิบเดียวกัน
 */
export function normalizeIngredientKey(name) {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/\//g, '-')      //กัน '/' เพราะใช้เป็น path separator ใน Firestore doc id ไม่ได้
    .replace(/\s+/g, ' ');
}

/**
 * ดึงรูปวัตถุดิบทั้งหมดมาเป็น map ครั้งเดียว { normalizedKey: imageDataUri }
 * ใช้โหลดตอนเปิดหน้า Admin เพื่อโชว์รูปที่มีอยู่แล้วทันทีตอนพิมพ์ชื่อวัตถุดิบซ้ำกับที่เคยอัปโหลดไว้
 */
export async function getAllIngredientPhotos() {
  const snap = await getDocs(collection(db, 'ingredientPhotos'));
  const map = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    if (data?.image) map[d.id] = data.image;
  });
  return map;
}

/**
 * ดึงรูปวัตถุดิบทีละชื่อ (เผื่อใช้ฝั่ง user ตอนแสดงหน้ารายละเอียดเมนู)
 */
export async function getIngredientPhoto(name) {
  const key = normalizeIngredientKey(name);
  if (!key) return null;
  const snap = await getDoc(doc(db, 'ingredientPhotos', key));
  if (!snap.exists()) return null;
  return snap.data().image || null;
}

/**
 * บันทึก/อัปเดตรูปวัตถุดิบ — ใช้ชื่อวัตถุดิบเป็น key เดียวกันทุกเมนูจะเห็นรูปเดียวกัน
 * imageDataUri = ผลลัพธ์จากการแปลงรูปเป็น base64 แล้ว (ทำที่ฝั่ง component ก่อนเรียกฟังก์ชันนี้)
 */
export async function saveIngredientPhoto(name, imageDataUri) {
  const key = normalizeIngredientKey(name);
  if (!key) {
    throw new Error('ต้องกรอกชื่อวัตถุดิบก่อนถึงจะแนบรูปได้');
  }
  await setDoc(doc(db, 'ingredientPhotos', key), {
    name: name.trim(),
    image: imageDataUri,
    updatedAt: new Date().toISOString(),
  });
  return key;
}