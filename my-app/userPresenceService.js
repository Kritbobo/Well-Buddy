// ══════════════════════════════════════════════════════════════
//  WellBuddy — User Presence & Realtime Online/Offline Service
// ══════════════════════════════════════════════════════════════

import { AppState } from 'react-native';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

let presenceInitialized = false;
let heartbeatTimer = null;
let currentSub = null;

/**
 * ปรับปรุงสถานะออนไลน์ของผู้ใช้ใน Firestore
 */
async function markOnline(uid) {
  if (!uid) return;
  try {
    await updateDoc(doc(db, 'users', uid), {
      isOnline: true,
      lastSeen: serverTimestamp(),
    });
  } catch (err) {
    // ดักจับ error เงียบๆ หากเน็ตหลุดหรือไม่มีสิทธิ์
  }
}

/**
 * ปรับปรุงสถานะออฟไลน์ของผู้ใช้ใน Firestore
 */
export async function markOffline(uid) {
  const targetUid = uid || auth.currentUser?.uid;
  if (!targetUid) return;
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      isOnline: false,
      lastSeen: serverTimestamp(),
    });
  } catch (err) {
    // ignore
  }
}

/**
 * เริ่มต้น Heartbeat เพื่อส่งสัญญาณว่ายังใช้งานอยู่ทุกๆ 45 วินาที
 */
function startHeartbeat(uid) {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (auth.currentUser && auth.currentUser.uid === uid && AppState.currentState === 'active') {
      updateDoc(doc(db, 'users', uid), {
        lastSeen: serverTimestamp(),
      }).catch(() => {});
    }
  }, 45000);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * เริ่มต้นระบบติดตามสถานะผู้ใช้แบบ Realtime
 * - เมื่อแอปเปิด / เข้าหน้าจอ (active) -> isOnline = true
 * - เมื่อแอปพับหน้าจอ / ไปเบื้องหลัง (background/inactive) -> isOnline = false, lastSeen = serverTimestamp()
 * - เมื่อเข้าสู่ระบบ -> isOnline = true
 */
export function initUserPresence() {
  if (presenceInitialized) return;
  presenceInitialized = true;

  // 1. ตรวจสอบการเปลี่ยนสถานะแอป (AppState)
  currentSub = AppState.addEventListener('change', (nextAppState) => {
    const user = auth.currentUser;
    if (!user) return;

    if (nextAppState === 'active') {
      markOnline(user.uid);
      startHeartbeat(user.uid);
    } else if (nextAppState.match(/inactive|background/)) {
      markOffline(user.uid);
      stopHeartbeat();
    }
  });

  // 2. ตรวจสอบสถานะการเข้าสู่ระบบ (Auth state)
  auth.onAuthStateChanged((user) => {
    if (user) {
      if (AppState.currentState === 'active') {
        markOnline(user.uid);
        startHeartbeat(user.uid);
      }
    } else {
      stopHeartbeat();
    }
  });

  // ถ้าเปิดแอปมาแล้วมีผู้ใช้ล็อกอินค้างอยู่ และแอป active ให้ส่งสถานะออนไลน์ทันที
  if (auth.currentUser && AppState.currentState === 'active') {
    markOnline(auth.currentUser.uid);
    startHeartbeat(auth.currentUser.uid);
  }
}
