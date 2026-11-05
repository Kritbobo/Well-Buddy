import { db } from './firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

/**
 * ดึงเมนูทั้งหมดในหมวดหมู่ที่กำหนด จาก collection 'menus' (เอกสารระดับบนสุด อัปโหลดเองผ่าน Firebase Console)
 * category = 'อาหาร' | 'เครื่องดื่ม' | 'Snacks' | 'Sauce'
 */
export async function getMenusByCategory(category, includeHidden = false) {
  const ref = collection(db, 'menus');
  let q;
  if (category === 'ขนม' || category === 'Snacks' || category === 'Dessert' || category === 'ของว่าง') {
    q = query(ref, where('category', 'in', ['ขนม', 'Snacks', 'Dessert', 'ของว่าง']));
  } else if (category === 'อาหาร' || category === 'Food') {
    q = query(ref, where('category', 'in', ['อาหาร', 'Food']));
  } else if (category === 'เครื่องดื่ม' || category === 'Drink' || category === 'Beverages') {
    q = query(ref, where('category', 'in', ['เครื่องดื่ม', 'Drink', 'Drinks', 'Beverages']));
  } else if (category === 'Sauce' || category === 'ซอส' || category === 'น้ำจิ้ม') {
    q = query(ref, where('category', 'in', ['Sauce', 'ซอส', 'น้ำจิ้ม']));
  } else {
    q = query(ref, where('category', '==', category));
  }
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (includeHidden) return items;
  return items.filter((m) => !m.isHidden && !m.hidden && m.status !== 'hidden');
}

/**
 * ดึงเมนูเดียวแบบเต็ม (พร้อม ingredientGroups, equipment, manual) ตาม document id
 */
export async function getMenuById(menuId) {
  if (!menuId) return null;
  const ref = doc(db, 'menus', menuId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * ดึงแผนผังรูปภาพหน้าปกของเมนูทั้งหมด { [menuName.toLowerCase()]: coverImageUrl }
 * เพื่อใช้เติมรูปภาพให้อาหารใน Dashboard กรณีที่ log เก่าไม่มี imageUri
 */
export async function getMenuImageMap() {
  try {
    const ref = collection(db, 'menus');
    const snap = await getDocs(ref);
    const map = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      const rawName = (data.name || '').replace(/\n/g, ' ').trim().toLowerCase();
      const cover =
        (data.images || []).find((img) => typeof img === 'string' && (img.startsWith('http') || img.startsWith('data:image') || img.startsWith('file://'))) ||
        (typeof data.image === 'string' && (data.image.startsWith('http') || data.image.startsWith('data:image')) ? data.image : null);
      if (rawName && cover) {
        map[rawName] = cover;
      }
    });
    return map;
  } catch (err) {
    console.log('getMenuImageMap error:', err.message);
    return {};
  }
}