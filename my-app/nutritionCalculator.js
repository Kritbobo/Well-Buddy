// ====================================================================
// nutritionCalculator.js
// ฟังก์ชันคำนวณ BMR / TDEE / สารอาหารหลักต่อวัน
// แยกออกมาต่างหากเพื่อให้แก้สูตรได้ง่ายในอนาคต โดยไม่กระทบ UI
// ====================================================================

// ====================================================================
// การแปลงหน่วย: ปอนด์ -> กิโลกรัม, ฟุต/นิ้ว -> เซนติเมตร
// สูตรคำนวณทั้งไฟล์ใช้หน่วย กก./ซม. เป็นหลัก ถ้าผู้ใช้กรอกเป็นปอนด์/ฟุต
// ให้แปลงเป็น กก./ซม. ก่อนเสมอ (และแนะนำให้เก็บลง Firestore เป็น กก./ซม.
// เหมือนเดิม เพื่อให้หน้าอื่นที่อ่านค่า weight/height ยังใช้งานได้ปกติ)
// ====================================================================
const KG_PER_POUND = 0.45359237;
const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;

// ปัดทศนิยม 1 ตำแหน่ง ให้ค่าที่เก็บ/แสดงอ่านง่าย (คลาดเคลื่อนน้อยมากจนไม่กระทบการคำนวณ)
const round1 = (n) => Math.round(n * 10) / 10;

// ปอนด์ -> กิโลกรัม (เช่น 154 lb = 69.9 kg)
export function poundsToKg(pounds) {
  return round1(Number(pounds) * KG_PER_POUND);
}

// ฟุต + นิ้ว -> เซนติเมตร (เช่น 5 ฟุต 7 นิ้ว = 170.2 ซม.)
// ช่องนิ้วไม่ใส่ก็ได้ แต่ถ้าไม่ใส่ ค่าฟุตจะถูกตีความเป็นฟุตแบบทศนิยมตรงๆ
// เช่น 5.7 = 5.7 ฟุต (173.7 ซม.) ไม่ใช่ 5 ฟุต 7 นิ้ว (170.2 ซม.)
// จึงแนะนำให้หน้ากรอกข้อมูลแยกช่อง "ฟุต" กับ "นิ้ว" ออกจากกัน
export function feetInchesToCm(feet, inches = 0) {
  const totalInches = Number(feet) * INCHES_PER_FOOT + Number(inches || 0);
  return round1(totalInches * CM_PER_INCH);
}

// รับค่าที่ผู้ใช้กรอกได้ทั้งแบบเมตริก (weightKg/heightCm) หรือแบบปอนด์/ฟุต
// (weightLb/heightFt/heightIn) แล้วคืนเป็น กก./ซม. เสมอ
// ถ้ามีทั้งสองแบบพร้อมกัน จะใช้ค่าแบบเมตริกก่อน
export function resolveMeasurements({ weightKg, weightLb, heightCm, heightFt, heightIn }) {
  return {
    weightKg: weightKg != null ? Number(weightKg) : poundsToKg(weightLb), 
    heightCm: heightCm != null ? Number(heightCm) : feetInchesToCm(heightFt, heightIn),
  };
}

// คำนวณ BMR (Basal Metabolic Rate) ด้วยสูตร Mifflin-St Jeor
export function calculateBMR({ gender, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

// คำนวณค่าดัชนีมวลกาย (Body Mass Index)
// สูตร: น้ำหนัก(kg) หารด้วย ส่วนสูง(m) ยกกำลังสอง
// ปัดทศนิยม 1 ตำแหน่งเพื่อให้อ่านง่ายตอนแสดงผล
export function calculateBMI({ weightKg, heightCm }) {
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
}

// เกณฑ์จำแนกระดับ BMI
// - 'who': มาตรฐานสากลขององค์การอนามัยโลก
// - 'asia': WHO Asia-Pacific เกณฑ์ที่ใช้กับคนเอเชีย (เข้มกว่า เพราะคนเอเชีย
//   มักสะสมไขมันช่องท้องได้มากกว่าที่ BMI สากลจะสะท้อน) ใช้เป็นค่าเริ่มต้น
//   เพราะแอปนี้เป็นภาษาไทย
const BMI_THRESHOLDS = {
  who: [
    { max: 18.5, key: 'underweight', label: 'น้ำหนักน้อยกว่าเกณฑ์' },
    { max: 25, key: 'normal', label: 'น้ำหนักปกติ' },
    { max: 30, key: 'overweight', label: 'น้ำหนักเกิน' },
    { max: 35, key: 'obese1', label: 'อ้วนระดับ 1' },
    { max: Infinity, key: 'obese2', label: 'อ้วนระดับ 2' },
  ],
  asia: [
    { max: 18.5, key: 'underweight', label: 'น้ำหนักน้อยกว่าเกณฑ์' },
    { max: 23, key: 'normal', label: 'น้ำหนักปกติ' },
    { max: 25, key: 'overweight', label: 'น้ำหนักเกิน' },
    { max: 30, key: 'obese1', label: 'อ้วนระดับ 1' },
    { max: Infinity, key: 'obese2', label: 'อ้วนระดับ 2' },
  ],
};

// จำแนกค่า BMI เป็นหมวดหมู่ พร้อม label ภาษาไทยไว้แสดงผลได้ทันที
export function classifyBMI(bmi, standard = 'asia') {
  const thresholds = BMI_THRESHOLDS[standard] || BMI_THRESHOLDS.asia;
  const match = thresholds.find((t) => bmi < t.max);
  return match || thresholds[thresholds.length - 1];
}

// ตัวคูณระดับกิจกรรมตามความถี่การออกกำลังกายต่อสัปดาห์
export const ACTIVITY_MULTIPLIERS = {
  low: 1.2, // 0-2 ครั้ง/สัปดาห์
  medium: 1.55, // 3-5 ครั้ง/สัปดาห์
  high: 1.725, // 6+ ครั้ง/สัปดาห์
};

export function calculateTDEE(bmr, activityLevel) {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.low;
  return bmr * multiplier;
}

// ปรับแคลอรี่เป้าหมายตามความต้องการ (ลด/คุม/เพิ่มน้ำหนัก)
export function adjustCaloriesForGoal(tdee, goal) {
  switch (goal) {
    case 'lose':
      return tdee - 500;
    case 'gain':
      return tdee + 400;
    case 'maintain':
    default:
      return tdee;
  }
}

// คำนวณสัดส่วนสารอาหารหลัก (โปรตีน / คาร์บ / ไขมัน) เป็นกรัม
export function calculateMacros({ calories, weightKg, goal }) {
  // โปรตีน: กรัมต่อน้ำหนักตัว 1 กก. (เป้าหมายลด/เพิ่มน้ำหนักใช้โปรตีนสูงกว่าคุมน้ำหนัก)
  const proteinPerKg = goal === 'maintain' ? 1.8 : 2.1;
  const proteinG = Math.round(weightKg * proteinPerKg);
  const proteinCal = proteinG * 4;

  // ไขมัน: 25% ของแคลอรี่ทั้งหมด
  const fatCal = calories * 0.25;
  const fatG = Math.round(fatCal / 9);

  // คาร์บ: ส่วนที่เหลือจากโปรตีนและไขมัน
  const carbCal = Math.max(calories - proteinCal - fatCal, 0);
  const carbG = Math.round(carbCal / 4);

  return { proteinG, carbG, fatG };
}

// ฟังก์ชันหลัก: รวมทุกขั้นตอน คืนค่าแคลอรี่ + สารอาหารหลักต่อวัน
// รับน้ำหนัก/ส่วนสูงได้ 2 แบบ (ส่งแบบใดแบบหนึ่ง):
//   - เมตริก:  weightKg, heightCm            (ใช้แบบเดิมได้เลย ไม่ต้องแก้ที่เรียกอยู่)
//   - อิมพีเรียล: weightLb, heightFt, heightIn (นิ้วใส่หรือไม่ใส่ก็ได้)
export function calculateNutritionPlan({
  gender,
  weightKg: weightKgInput,
  weightLb,
  heightCm: heightCmInput,
  heightFt,
  heightIn,
  age,
  activityLevel,
  goal,
}) {
  const { weightKg, heightCm } = resolveMeasurements({
    weightKg: weightKgInput,
    weightLb,
    heightCm: heightCmInput,
    heightFt,
    heightIn,
  });

  const bmr = calculateBMR({ gender, weightKg, heightCm, age });
  const tdee = calculateTDEE(bmr, activityLevel);
  const targetCalories = Math.round(adjustCaloriesForGoal(tdee, goal));
  const { proteinG, carbG, fatG } = calculateMacros({
    calories: targetCalories,
    weightKg,
    goal,
  });
  const bmi = calculateBMI({ weightKg, heightCm });
  const bmiCategory = classifyBMI(bmi);

  return {
    calories: targetCalories,
    proteinG,
    carbG,
    fatG,
    bmi,
    bmiCategory: bmiCategory.key,
    bmiLabel: bmiCategory.label,
  };
}