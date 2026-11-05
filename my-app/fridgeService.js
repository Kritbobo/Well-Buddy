import { db, storage } from './firebase';
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const FRIDGE_CATEGORIES = ['Vegetables', 'Fruit', 'Meat', 'Drinks', 'Others'];

// ไอคอนเริ่มต้นตามหมวดหมู่ (ใช้ตอนยังไม่มีรูปจริง)
export const FRIDGE_ICON_BY_CATEGORY = {
  Vegetables: 'nutrition-outline',
  Fruit: 'leaf-outline',
  Meat: 'restaurant-outline',
  Drinks: 'water-outline',
  Others: 'ellipsis-horizontal-circle-outline',
};

/**
 * คำนวณจำนวนวันที่เหลือก่อนหมดอายุ จาก expiryDate (ISO string 'YYYY-MM-DD')
 * คืนค่าเป็นจำนวนเต็ม (ปัดขึ้น) ติดลบได้ถ้าหมดอายุไปแล้ว
 */
export function daysLeftFor(expiryDate) {
  if (!expiryDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
}

/**
 * แปลง local URI (จากกล้อง/คลังภาพ) เป็น Blob สำหรับอัปโหลดขึ้น Firebase Storage
 */
function uriToBlob(uri) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('แปลงไฟล์รูปไม่สำเร็จ (network request failed)'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

/**
 * อัปโหลดรูปวัตถุดิบ (จากกล้องหรือคลังภาพ) ขึ้น Firebase Storage แล้วคืน download URL
 */
export async function uploadFridgeImageAsync(localUri) {
  const blob = await uriToBlob(localUri);
  const filename = `fridge-images/${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const storageRef = ref(storage, filename);
  try {
    await uploadBytes(storageRef, blob);
  } finally {
    blob.close && blob.close();
  }
  return getDownloadURL(storageRef);
}

/**
 * เพิ่มวัตถุดิบเข้าตู้เย็นของผู้ใช้ uid
 */
export async function addFridgeItem(uid, entry) {
  if (!uid) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  const ref_ = collection(db, 'users', uid, 'fridgeItems');
  return addDoc(ref_, {
    name: entry.name || 'ไม่ทราบชื่อ',
    amount: entry.amount || '',
    category: FRIDGE_CATEGORIES.includes(entry.category) ? entry.category : null,
    expiryDate: entry.expiryDate || null,
    image: entry.image || null,
    createdAt: serverTimestamp(),
  });
}

/** ลบวัตถุดิบออกจากตู้เย็น (เช่น ใช้หมดแล้ว) */
export async function deleteFridgeItem(uid, itemId) {
  if (!uid) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  await deleteDoc(doc(db, 'users', uid, 'fridgeItems', itemId));
}

/**
 * แก้ไขข้อมูลบางส่วนของวัตถุดิบที่มีอยู่แล้ว
 */
export async function updateFridgeItem(uid, itemId, updates) {
  if (!uid) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  await updateDoc(doc(db, 'users', uid, 'fridgeItems', itemId), updates);
}

/**
 * ทำชื่อวัตถุดิบให้เทียบกันง่ายๆ
 */
function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

/**
 * หาวัตถุดิบในตู้เย็นที่ตรง (หรือใกล้เคียง) กับชื่อวัตถุดิบในสูตรอาหาร
 */
export function findMatchingFridgeItem(recipeItemName, fridgeItems) {
  const target = normalizeName(recipeItemName);
  if (!target || !Array.isArray(fridgeItems)) return null;

  const exact = fridgeItems.find((it) => normalizeName(it.name) === target);
  if (exact) return exact;

  const partial = fridgeItems.find((it) => {
    const n = normalizeName(it.name);
    return n && (n.includes(target) || target.includes(n));
  });
  return partial || null;
}

/**
 * แปลง string จำนวน เช่น "400g", "1/2 cup", "1 tbsp" เป็น { value, unit }
 */
function parseAmount(amountStr) {
  const s = (amountStr || '').trim();
  if (!s) return { value: 0, unit: '' };

  const fractionMatch = s.match(/^(\d+)\s*\/\s*(\d+)/);
  let value = 0;
  let rest = s;

  if (fractionMatch) {
    const whole = parseInt(fractionMatch[1], 10);
    const denom = parseInt(fractionMatch[2], 10);
    value = denom ? whole / denom : 0;
    rest = s.slice(fractionMatch[0].length);
  } else {
    const numMatch = s.match(/^[\d.]+/);
    if (numMatch) {
      value = parseFloat(numMatch[0]) || 0;
      rest = s.slice(numMatch[0].length);
    }
  }

  const unit = rest.trim().toLowerCase();
  return { value, unit };
}

/**
 * จัดรูปแบบตัวเลขให้อ่านง่าย
 */
function formatAmountValue(value) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/**
 * แปลง unit string ให้เป็นหมวดหมู่และ factor สำหรับแปลงเป็น base unit
 */
function normalizeUnit(unitStr) {
  const u = (unitStr || '').trim().toLowerCase();
  if (!u) return { type: 'none', factor: 1, name: '' };

  // Weight (base unit: g)
  if (['kg', 'กก.', 'กก', 'กิโลกรัม', 'kilogram', 'kilograms'].includes(u)) {
    return { type: 'weight', factor: 1000, name: 'kg' };
  }
  if (['g', 'กรัม', 'ก.', 'gram', 'grams'].includes(u)) {
    return { type: 'weight', factor: 1, name: 'g' };
  }
  if (['mg', 'มิลลิกรัม'].includes(u)) {
    return { type: 'weight', factor: 0.001, name: 'mg' };
  }

  // Volume (base unit: ml)
  if (['l', 'ลิตร', 'liter', 'liters'].includes(u)) {
    return { type: 'volume', factor: 1000, name: 'l' };
  }
  if (['ml', 'มิลลิลิตร', 'มล.', 'milliliter', 'milliliters'].includes(u)) {
    return { type: 'volume', factor: 1, name: 'ml' };
  }

  // Count / Pieces
  if (['pcs', 'piece', 'pieces', 'ชิ้น', 'ลูก', 'ฟอง', 'หัว', 'ต้น', 'กลีบ'].includes(u)) {
    return { type: 'count', factor: 1, name: u };
  }

  // Spoons / Cups
  if (['tbsp', 'ช้อนโต๊ะ'].includes(u)) {
    return { type: 'spoon_tbsp', factor: 1, name: u };
  }
  if (['tsp', 'ช้อนชา'].includes(u)) {
    return { type: 'spoon_tsp', factor: 1, name: u };
  }
  if (['cup', 'ถ้วย'].includes(u)) {
    return { type: 'cup', factor: 1, name: u };
  }

  return { type: u, factor: 1, name: u };
}

/**
 * คำนวณว่าวัตถุดิบในตู้เย็นจะเหลือเท่าไหร่หลังทำสูตรนี้
 */
export function calculateItemDeduction(recipeAmountStr, fridgeAmountStr, scale = 1) {
  const recipeParsed = parseAmount(recipeAmountStr);
  const fridgeParsed = parseAmount(fridgeAmountStr);
  const neededValue = recipeParsed.value * (scale || 1);

  if (!fridgeParsed.value) {
    return { action: 'none', remainingStr: null, fridgeBaseValue: 0 };
  }

  const recipeUnit = normalizeUnit(recipeParsed.unit);
  const fridgeUnit = normalizeUnit(fridgeParsed.unit);

  let remainingStr = null;
  let action = 'none';

  const isComparable =
    (recipeUnit.type === 'none' && fridgeUnit.type === 'none') ||
    (recipeUnit.type !== 'none' && recipeUnit.type === fridgeUnit.type) ||
    (!recipeParsed.unit && !fridgeParsed.unit);

  if (isComparable && recipeParsed.value > 0) {
    const fridgeInBase = fridgeParsed.value * fridgeUnit.factor;
    const neededInBase = neededValue * recipeUnit.factor;
    const remainingInBase = fridgeInBase - neededInBase;

    if (remainingInBase <= 0.0001) {
      action = 'delete';
    } else {
      action = 'update';
      const remainingInFridgeUnit = remainingInBase / fridgeUnit.factor;
      const formattedValue = formatAmountValue(remainingInFridgeUnit);
      const displayUnit = fridgeParsed.unit ? ` ${fridgeParsed.unit}` : '';
      remainingStr = `${formattedValue}${displayUnit}`.trim();
    }
  } else if (recipeParsed.unit === fridgeParsed.unit) {
    const remaining = fridgeParsed.value - neededValue;
    if (remaining <= 0.0001) {
      action = 'delete';
    } else {
      action = 'update';
      const formattedValue = formatAmountValue(remaining);
      const displayUnit = fridgeParsed.unit ? ` ${fridgeParsed.unit}` : '';
      remainingStr = `${formattedValue}${displayUnit}`.trim();
    }
  } else {
    action = 'none';
  }

  return { action, remainingStr, fridgeBaseValue: fridgeParsed.value };
}

/**
 * หักวัตถุดิบในตู้เย็นทีเดียวหลายรายการ
 */
export async function deductFridgeItemsBatch(uid, deductions) {
  if (!uid) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  if (!Array.isArray(deductions) || deductions.length === 0) return;

  await Promise.all(
    deductions.map((d) => {
      if (d.action === 'delete') {
        return deleteFridgeItem(uid, d.itemId);
      }
      if (d.action === 'update') {
        return updateFridgeItem(uid, d.itemId, { amount: d.newAmount });
      }
      return Promise.resolve();
    })
  );
}

/**
 * ฟังรายการของในตู้เย็นแบบเรียลไทม์
 */
export function subscribeFridgeItems(uid, callback) {
  if (!uid) return () => {};
  const ref = collection(db, 'users', uid, 'fridgeItems');
  const q = query(ref, orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          daysLeft: daysLeftFor(data.expiryDate),
          icon: FRIDGE_ICON_BY_CATEGORY[data.category] || 'nutrition-outline',
          dateLabel: data.expiryDate ? `หมดอายุ ${data.expiryDate}` : '',
        };
      });
      callback(items);
    },
    (err) => {
      console.log('subscribeFridgeItems error:', err.message);
      callback([]);
    }
  );
}