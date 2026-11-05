const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

// Groq — ใช้กับแชท NutriBot เพื่อประหยัดโควตา Gemini (free tier 20 req/วัน)
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-20b';

export async function analyzeFood(base64Image) {
  const body = {
    contents: [{
      parts: [
        { text: `วิเคราะห์อาหารในรูปนี้ ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น รูปแบบ:
{"name":"ชื่ออาหารภาษาไทย","calories":ตัวเลข,"protein":ตัวเลข,"carbs":ตัวเลข,"fat":ตัวเลข}
ถ้าไม่ใช่อาหารตอบ {"error":"ไม่พบอาหาร"}` },
        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
      ]
    }]
  };

  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  console.log('GEMINI RESPONSE:', JSON.stringify(data));
  if (!data.candidates) {
    throw new Error(data.error?.message || 'ไม่ได้รับผลจาก AI');
  }
  const text = data.candidates[0].content.parts[0].text;
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

const GOAL_TH = { lose: 'ลดน้ำหนัก', maintain: 'คุมน้ำหนัก', gain: 'เพิ่มน้ำหนัก' };

/**
 * ให้ AI จัดอันดับเมนูที่ query มาจาก Firestore แล้ว ตามความเหมาะสมกับโปรไฟล์ผู้ใช้
 * profile = ข้อมูลจาก Firestore (users/{uid})
 * menus = array ของเมนู [{ id, name, kcal, protein, ... }] ที่ query มาแล้ว (ยังไม่ได้เรียง)
 * คืนค่า array ของเมนูเรียงลำดับใหม่ (เหมาะสุด -> น้อยสุด)
 * ถ้า AI ตอบไม่ได้/parse ไม่ออก จะคืน [] ให้ฝั่งเรียกใช้ fallback ไปโชว์ menus เดิมแทน
 */
export async function getMealRecommendations(profile, menus) {
  if (!menus || menus.length === 0) return [];

  const p = profile || {};
  const menuListText = menus
    .map((m, i) => `${i}. ${m.name} (${m.kcal || 0} kcal, โปรตีน ${m.protein || 0}g)`)
    .join('\n');

  const promptText = `คุณคือผู้ช่วยแนะนำเมนูอาหารในแอป WellBuddy
ข้อมูลผู้ใช้:
- เป้าแคลอรี่: ${p.calories || '-'} kcal/วัน
- เป้าโปรตีน: ${p.protein || '-'}g
- BMI: ${p.bmi || '-'} (${p.bmiLabel || '-'})
- เป้าหมาย: ${GOAL_TH[p.goal] || '-'}

รายการเมนูที่มี (index เริ่มจาก 0):
${menuListText}

เรียงลำดับเมนูเหล่านี้จากเหมาะกับผู้ใช้มากที่สุดไปน้อยที่สุด
ตอบเป็น JSON array ของ index เท่านั้น เช่น [2,0,1] ห้ามมีข้อความอื่น`;

  const body = {
    contents: [{ parts: [{ text: promptText }] }],
  };

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.candidates) {
      throw new Error(data.error?.message || 'ไม่ได้รับผลจาก AI');
    }

    const text = data.candidates[0].content.parts[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    const order = JSON.parse(clean);
    if (!Array.isArray(order)) {
      throw new Error('รูปแบบผลลัพธ์ไม่ถูกต้อง');
    }

    const ranked = order.map((idx) => menus[idx]).filter(Boolean);
    // เผื่อ AI ตอบ index มาไม่ครบทุกเมนู เติมรายการที่เหลือต่อท้ายไว้ (ไม่ให้เมนูหายไปจากลิสต์)
    const rankedIds = new Set(ranked.map((m) => m.id));
    const remaining = menus.filter((m) => !rankedIds.has(m.id));
    return [...ranked, ...remaining];
  } catch (error) {
    console.log('getMealRecommendations error:', error.message);
    return [];
  }
}

/**
 * แชทกับ NutriBot
 * profile = ข้อมูลจาก Firestore (users/{uid})
 * question = คำถามที่ผู้ใช้พิมพ์
 * history = [{ role: 'user'|'model', text: '...' }] บทสนทนาก่อนหน้า
 * eaten = { calories, protein } ที่กินไปวันนี้ (ยังไม่มี foodLogs ส่ง null ได้)
 */
function buildChatSystemText(profile, eaten, lang = 'th') {
  const p = profile || {};
  // บรรทัดคำสั่งภาษา — ส่วนข้อมูลผู้ใช้ด้านล่างเป็นข้อมูลให้ AI อ่าน ไม่ต้องแปล
  const langLine =
    lang === 'en'
      ? 'Reply in English only. Keep it short, max 4 lines. Do not greet again.'
      : 'ตอบภาษาไทยเท่านั้น สั้น กระชับ ไม่เกิน 4 บรรทัด ไม่ต้องทักทายซ้ำ';
  const eatenText = eaten
    ? `- วันนี้กินไป: ${eaten.calories} kcal, โปรตีน ${eaten.protein}g`
    : '- วันนี้ยังไม่มีข้อมูลมื้ออาหาร';

  return `คุณคือ NutriBot ผู้ช่วยโภชนาการในแอป WellBuddy
${langLine}
ห้ามวินิจฉัยโรคหรือสั่งยา ถ้าถามเรื่องโรคให้แนะนำไปพบแพทย์

ข้อมูลผู้ใช้:
- ชื่อ: ${p.name || '-'}
- เป้าแคลอรี่: ${p.calories || '-'} kcal/วัน
- เป้าโปรตีน: ${p.protein || '-'}g / คาร์บ: ${p.carb || '-'}g / ไขมัน: ${p.fat || '-'}g
- BMI: ${p.bmi || '-'} (${p.bmiLabel || '-'})
- เป้าหมาย: ${GOAL_TH[p.goal] || '-'}
- อายุ ${p.age || '-'} ปี เพศ ${p.gender === 'male' ? 'ชาย' : p.gender === 'female' ? 'หญิง' : '-'}
- ส่วนสูง: ${p.height || '-'} ซม. น้ำหนัก: ${p.weight || '-'} กก.
- ระดับกิจกรรม: ${p.activityLevel === 'low' ? 'น้อย (0-2 ครั้ง/สัปดาห์)' : p.activityLevel === 'medium' ? 'ปานกลาง (3-5 ครั้ง/สัปดาห์)' : p.activityLevel === 'high' ? 'มาก (6+ ครั้ง/สัปดาห์)' : '-'}
${eatenText}`;
}

/**
 * แชทกับ NutriBot ผ่าน Gemini (ตัวสำรอง — ปุ่มสลับในหน้าแชท)
 */
export async function chatWithNutriBot(profile, question, history = [], eaten = null, lang = 'th') {
  const systemText = buildChatSystemText(profile, eaten, lang);

  const contents = [
    ...history.map((h) => ({
      role: h.role,
      parts: [{ text: h.text }],
    })),
    { role: 'user', parts: [{ text: question }] },
  ];

  const body = {
    system_instruction: { parts: [{ text: systemText }] },
    contents,
  };

  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.candidates) {
    throw new Error(data.error?.message || 'ไม่ได้รับคำตอบจาก AI');
  }
  return data.candidates[0].content.parts[0].text.trim();
}

/**
 * แชทกับ NutriBot ผ่าน Groq (ตัวหลัก — โควตาเยอะกว่า Gemini free tier)
 * พารามิเตอร์เหมือน chatWithNutriBot ทุกอย่าง สลับใช้แทนกันได้
 */
export async function chatWithGroq(profile, question, history = [], eaten = null, lang = 'th') {
  const systemText = buildChatSystemText(profile, eaten, lang);

  const body = {
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: systemText },
      // Gemini ใช้ role 'model' แต่ฝั่ง OpenAI-compatible ใช้ 'assistant'
      ...history.map((h) => ({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.text,
      })),
      { role: 'user', content: question },
    ],
    temperature: 0.6,
    max_tokens: 500,
  };

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(data?.error?.message || 'ไม่ได้รับคำตอบจาก Groq');
  }
  return text.trim();
}