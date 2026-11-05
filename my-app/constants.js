export const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export const TIME_SLOTS = [
  { t: '09:00', full: false }, { t: '09:30', full: false }, { t: '10:00', full: true },
  { t: '10:30', full: false }, { t: '11:00', full: true }, { t: '11:30', full: false },
  { t: '13:00', full: false }, { t: '13:30', full: false }, { t: '14:00', full: false },
  { t: '14:30', full: true }, { t: '15:00', full: false }, { t: '15:30', full: false },
  { t: '16:00', full: false }, { t: '16:30', full: false }, { t: '17:00', full: true },
  { t: '17:30', full: false }
];
export const SERVICES = [
  { name: 'ตรวจฟันทั่วไป', image: require('./assets/1.jpg'),    price: '฿300 – 500' },
  { name: 'อุดฟัน',         image: require('./assets/2.jpg'),     price: '฿500 – 1,500' },
  { name: 'ขูดหินปูน',      image: require('./assets/3.jpg'),     price: '฿600 – 1,000' },
  { name: 'จัดฟัน',         image: require('./assets/4.jpg'),      price: '฿35,000+' },
  { name: 'ถอนฟัน',         image: require('./assets/5.jpg'),  price: '฿300 – 2,000' },
  { name: 'ฟอกฟันขาว',     image: require('./assets/6.jpg'),   price: '฿3,500 – 8,000' }
];

// API key มาจาก .env (EXPO_PUBLIC_GEMINI_API_KEY) — ไม่ฮาร์ดโค้ดลง source แล้ว
export const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

// ── ทีมทันตแพทย์ประจำคลินิก (ใช้ในระบบ "คุยกับหมอ") ──
// online = สถานะตั้งต้น (จำลองหมอที่ Active / ไม่ Active) — Admin toggle ได้
export const DOCTORS = [
  { id: 'gen',  name: 'ทพ. ธนกร ศรีวัฒน์',     title: 'ทันตแพทย์ทั่วไป',    initial: 'ธ', honor: 'ครับ', online: true,  blurb: 'ตรวจฟัน อุดฟัน ขูดหินปูน', dutyDays: [1, 2, 4, 5], dutyDaysLabel: 'จันทร์, อังคาร, พฤหัสบดี, ศุกร์' },
  { id: 'orth', name: 'ทพญ. พิมพ์ชนก วงศ์ทอง', title: 'ทันตแพทย์จัดฟัน',     initial: 'พ', honor: 'ค่ะ',  online: true,  blurb: 'จัดฟัน เครื่องมือใส', dutyDays: [3, 6], dutyDaysLabel: 'พุธ, เสาร์' },
  { id: 'pedo', name: 'ทพญ. ศิริพร ใจดี',       title: 'ทันตกรรมสำหรับเด็ก',  initial: 'ศ', honor: 'ค่ะ',  online: true,  blurb: 'ดูแลฟันเด็ก', dutyDays: [2, 6, 0], dutyDaysLabel: 'อังคาร, เสาร์, อาทิตย์' },
  { id: 'surg', name: 'ทพ. อนุชา เรืองสิน',     title: 'ศัลยกรรมช่องปาก',     initial: 'อ', honor: 'ครับ', online: false, awayUntil: 'กลับ 13:00 น.',       blurb: 'ถอนฟันคุด ผ่าตัด', dutyDays: [1, 3, 5], dutyDaysLabel: 'จันทร์, พุธ, ศุกร์' },
  { id: 'endo', name: 'ทพ. กิตติพงษ์ มั่นคง',   title: 'รักษารากฟัน',         initial: 'ก', honor: 'ครับ', online: false, awayUntil: 'กลับพรุ่งนี้ 9:00 น.', blurb: 'รักษารากฟัน เจ็บฟันรุนแรง', dutyDays: [4, 0], dutyDaysLabel: 'พฤหัสบดี, อาทิตย์' },
];

// ข้อความทักทายของหมอแต่ละคน (ใช้ตอน seed แชต)
export const doctorWelcome = (d) =>
  `สวัสดี${d.honor} ${d.name}\nดูแลด้าน${d.title} — ${d.blurb}\n\nมีอาการหรือข้อสงสัยเรื่องฟัน ปรึกษาได้เลย${d.honor}`;