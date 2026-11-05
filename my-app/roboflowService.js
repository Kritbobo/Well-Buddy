// Roboflow Workflow API (serverless) — ต่างจาก Hosted Inference API แบบเก่า
// ต้องมีแค่ EXPO_PUBLIC_ROBOFLOW_API_KEY ใน .env (ไม่ต้องมี MODEL แล้ว เพราะ URL เป็นของ workflow นี้ตายตัว)

const API_KEY = process.env.EXPO_PUBLIC_ROBOFLOW_API_KEY;

// URL เต็มของ Workflow (คัดลอกมาจากหน้า Deploy > HTTP/cURL ของคุณ)
const WORKFLOW_URL =
  'https://serverless.roboflow.com/organchum398-gmail-com/workflows/my-first-project-vmy-first-project-gufav-4-vit-base-patch16-224-in21k-t1-logic';

/**
 * ส่งรูป (base64 ไม่มี prefix data:image/...) ไปให้ Roboflow Workflow ตรวจจับว่าเป็นอาหารอะไร
 * คืนค่า: { name, confidence } ของ prediction ที่มั่นใจที่สุด
 * ถ้าตรวจจับไม่เจอเลย หรือรูปแบบผลลัพธ์ไม่ตรงที่คาดไว้ จะ throw error
 *
 * หมายเหตุ: โครงสร้าง JSON ที่ Workflow ตอบกลับมาขึ้นอยู่กับการตั้งค่า workflow ของแต่ละคน
 * โค้ดนี้พยายามอ่านหลายรูปแบบที่พบบ่อย ถ้ายังอ่านไม่ตรง ให้ดู log "ROBOFLOW RESPONSE"
 * ที่ปริ้นออกมา แล้วส่งมาให้ดู จะแก้ส่วนอ่านผลลัพธ์ให้ตรงเป๊ะได้
 */
export async function detectFood(base64Image) {
  const body = {
    api_key: API_KEY,
    inputs: {
      image: { type: 'base64', value: base64Image },
    },
  };

  const res = await fetch(WORKFLOW_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  console.log('ROBOFLOW RESPONSE:', JSON.stringify(data));

  if (data.error) {
    throw new Error(
      typeof data.error === 'string' ? data.error : data.error.message || 'Roboflow ตอบกลับผิดพลาด'
    );
  }

  // Workflow API มักห่อผลลัพธ์ไว้ใน outputs[0] — ลองดึงแบบยืดหยุ่นหลายรูปแบบที่พบบ่อย
  const output = data.outputs?.[0] ?? data;

  const predictionsBlock =
    output.predictions?.predictions !== undefined ? output.predictions :
    output.model_predictions?.predictions !== undefined ? output.model_predictions :
    output;

  let best = null;

  if (predictionsBlock?.top) {
    // รูปแบบ classification: { top: "83", confidence: 0.95, predictions: {...} }
    best = { class: predictionsBlock.top, confidence: predictionsBlock.confidence ?? 1 };
  } else if (Array.isArray(predictionsBlock?.predictions)) {
    best = predictionsBlock.predictions.reduce(
      (top, p) => (p.confidence > (top?.confidence || 0) ? p : top),
      null
    );
  } else if (Array.isArray(predictionsBlock)) {
    best = predictionsBlock.reduce(
      (top, p) => (p.confidence > (top?.confidence || 0) ? p : top),
      null
    );
  }

  const name = best?.class ?? best?.class_name ?? best?.label;

  if (!best || !name || String(name).trim() === '') {
    throw new Error('ไม่พบอาหารในรูปนี้ กรุณาถ่ายภาพใหม่อีกครั้งให้เห็นอาหารชัดเจน');
  }

  return {
    name: String(name).trim(),
    confidence: best.confidence ?? 0,
  };
}