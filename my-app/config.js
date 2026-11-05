import Constants from 'expo-constants';

// ===== โหมด PRODUCTION =====
// พอ deploy backend ขึ้น Render แล้ว ให้ปลดคอมเมนต์บรรทัดล่างนี้ และคอมเมนต์โค้ด auto-detect ด้านล่างทิ้ง
// export const API_BASE_URL = 'https://wellbuddy-backend.onrender.com';

// ===== โหมด DEV: ตรวจจับ IP อัตโนมัติ ใช้ได้ทั้ง Expo Go (สแกน QR) และ Android Studio Emulator =====
// Expo รู้อยู่แล้วว่า Metro bundler รันอยู่ที่ IP ไหนสำหรับอุปกรณ์ที่ต่ออยู่ตอนนั้น
// (IP วง LAN ตอนสแกน QR บนมือถือจริง / หรือ 10.0.2.2 ตอนใช้ Android Emulator)
// เราเลยดึง IP เดียวกันมาใช้ยิง API แทนที่จะ hardcode
const PORT = 3000;

function getDevHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost;

  if (hostUri) {
    return hostUri.split(':')[0]; // ตัดเอาแค่ IP ทิ้ง port เดิม
  }
  return 'localhost'; // fallback เผื่อหาไม่เจอจริงๆ
}

export const API_BASE_URL = `http://${getDevHost()}:${PORT}`;

// หมายเหตุ: ต้องรัน backend (npm start) ค้างไว้ที่คอมเครื่องเดียวกับที่รัน
// `npx expo start` และต้องอยู่วง WiFi/เครือข่ายเดียวกัน (กรณีทดสอบมือถือจริงผ่าน QR)