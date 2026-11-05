// ตารางคำแปลของแอป — เขียนเองล้วน ไม่ใช้ library i18n
// หลักการ: "ภาษาไทยคือต้นฉบับ" เลยใช้ข้อความไทยเป็น key ตรง ๆ
// อยากเพิ่มคำแปลใหม่ ก็เพิ่มบรรทัดใน EN ที่เดียวพอ

export const LANGUAGE_KEYS = ['th', 'en'];

// ชื่อเดือน/ชื่อวันเขียนเองทั้งหมด — ห้ามใช้ Intl หรือ toLocaleDateString
// เพราะ Hermes บางเครื่องไม่มี Intl แล้วแอปจะพังเฉพาะบางเครื่อง
export const MONTHS_SHORT = {
  th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

export const DAYS_SHORT = {
  th: ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

// ชื่อเต็ม — ใช้กับวันที่หัวหน้าแรก (HomeDashBoard)
export const MONTHS_LONG = {
  th: ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'],
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
};

export const DAYS_LONG = {
  th: ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'],
  en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
};

const EN = {
  'อีเมลล์': 'Email',
  'ชื่อผู้ใช้': 'Username',
  'ภาษา': 'Language',
  'ข้อกำหนดและเงื่อนไข': 'Terms & Conditions',
  'ออกจากระบบ': 'Log out',
  'ยืนยันการออกจากระบบใช่ไหม?': 'Are you sure you want to log out?',
  'ยกเลิก': 'Cancel',
  'ผิดพลาด': 'Error',
  'ผู้ใช้ WellBuddy': 'WellBuddy user',

  // ---- หน้าครอบครัว (FamilyScreen / FamilyDetailScreen / MemberDetailScreen) ----
  'กรอกรหัส': 'Enter code',
  'กรุณากรอกรหัสเชิญก่อน': 'Please enter an invite code first',
  'สำเร็จ': 'Success',
  'เข้าร่วมครอบครัวเรียบร้อย': 'Joined the family',
  'เข้าร่วมไม่สำเร็จ': "Couldn't join",
  'สร้างสำเร็จ': 'Family created',
  'รหัสเชิญของกลุ่มคือ {code}\nแชร์ให้คนในครอบครัวเข้าร่วมได้เลย':
    'Invite code: {code}\nShare it with your family so they can join',
  'สร้างไม่สำเร็จ': "Couldn't create family",
  'กรอกรหัส 6 ตัว': 'Enter 6-digit code',
  'ชื่อครอบครัว เช่น บ้านคุณมิว': 'Family name, e.g. The Mew Family',
  'เจ้าของ': 'Owner',
  'แชร์สุขภาพ': 'Share health',
  'ครอบครัว': 'Family',
  'มีรหัสเชิญอยู่แล้ว?': 'Already have an invite code?',
  'เข้าร่วม': 'Join',
  'ครอบครัวของฉัน': 'My families',
  'ยังไม่มีครอบครัว': 'No families yet',
  'สร้างใหม่ หรือเข้าร่วมด้วยรหัสเชิญ': 'Create one or join with an invite code',
  'สร้างครอบครัว': 'Create family',
  'สร้างครอบครัวใหม่': 'New family',
  'สร้าง': 'Create',
  'คาร์โบไฮเดรต': 'Carbs',
  'โปรตีน': 'Protein',
  'แคลอรี่': 'Calories',
  'ไขมัน': 'Fat',
  'คาร์บ': 'Carbs',
  'คาร์โบไฮเดรต (g)': 'Carbs (g)',
  'โปรตีน (g)': 'Protein (g)',
  'ไขมัน (g)': 'Fat (g)',
  'ออกจากครอบครัว': 'Leave family',
  'ต้องการออกจาก "{name}" ใช่ไหม? คุณจะไม่เห็นข้อมูลของสมาชิกอีก':
    "Leave \"{name}\"? You will no longer see members' data",
  'ออกจากกลุ่ม': 'Leave',
  'ไม่สำเร็จ': 'Failed',
  'ลบครอบครัว': 'Delete family',
  'ต้องการลบ "{name}" ใช่ไหม?\nสมาชิกทั้ง {count} คนจะหลุดออกจากกลุ่ม และลบแล้วกู้คืนไม่ได้':
    'Delete "{name}"?\nAll {count} members will be removed. This cannot be undone.',
  'ลบกลุ่ม': 'Delete',
  'คัดลอกแล้ว': 'Copied',
  'คัดลอก': 'Copy',
  'อายุ {age} ปี': 'Age {age}',
  'ดูรายละเอียด ›': 'View details ›',
  'ไม่พบข้อมูลครอบครัว': 'Family not found',
  'กลับ': 'Back',
  'สุขภาพครอบครัว': 'Family health',
  'เพิ่มครอบครัว': 'Add family',
  'แชร์รหัสให้คนในบ้านเข้าร่วม': 'Share this code to invite your family',
  'โค้ดเชิญ': 'Invite code',
  '* ดูข้อมูลได้อย่างเดียว แก้ไขของคนอื่นไม่ได้':
    "* View only — you can't edit other people's data",
  'ลบครอบครัวนี้': 'Delete this family',
  'สร้างข้อมูลตัวอย่าง': 'Generate sample data',
  'ลดน้ำหนัก': 'Lose weight',
  'คุมน้ำหนัก': 'Maintain weight',
  'เพิ่มน้ำหนัก': 'Gain weight',
  'ถึงเป้าหมายแล้ว 🎉': 'Goal reached 🎉',
  'เหลืออีก {n} kcal': '{n} kcal left',
  'วันนี้กินไปแล้ว': 'Eaten today',
  'แคลอรี่ 7 วันล่าสุด': 'Calories, last 7 days',
  'ยังไม่มีบันทึกมื้ออาหารวันนี้': 'No meals logged today',
  'วิเคราะห์เชิงลึก': 'Deep insights',
  'วันที่ {day}': 'Day {day}',
  'วันนี้ไม่มีบันทึกมื้ออาหาร': 'No meals logged this day',
  'kcal รวมทั้งวัน': 'kcal total',

  // ---- แถบน้ำ + ข้อความเตือนคนในครอบครัว (FamilyDetail / MemberDetail / แจ้งเตือน) ----
  'น้ำดื่ม': 'Water',
  'น้ำ (ml)': 'Water (ml)',
  'ส่งข้อความเตือน': 'Send a reminder',
  'เตือน {name}': 'Remind {name}',
  'สถานะวันนี้': "Today's status",
  'ยังกินไม่ถึงเป้า ขาดอีก {n} kcal': '{n} kcal short of the goal',
  'ยังดื่มน้ำไม่ถึงเป้า ขาดอีก {n} ml': '{n} ml short of the water goal',
  'วันนี้ทำได้ตามเป้าแล้ว': 'On track today',
  'พิมพ์ข้อความ (ไม่เกิน 200 ตัว)': 'Type a message (max 200 characters)',
  'ส่ง': 'Send',
  'ส่งข้อความแล้ว': 'Message sent',
  '{name} จะเห็นข้อความนี้ตอนเปิดแอป': '{name} will see it the next time they open the app',
  'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง': 'Could not send. Please try again.',
  'กรุณาพิมพ์ข้อความก่อนส่ง': 'Please type a message first',
  'ข้อความจาก {name}': 'Message from {name}',

  // ตัวย่อมาโครในการ์ดสรุป — ค/ป/ม คือ คาร์บ/โปรตีน/ไขมัน
  'ค': 'C',
  'ป': 'P',
  'ม': 'F',

  // ---- หน้าแจ้งเตือน (NotificationScreen) ----
  'การแจ้งเตือน': 'Notifications',
  'ทั้งหมด': 'All',
  'ของฉัน': 'Mine',
  'ค้นหาการแจ้งเตือน': 'Search notifications',
  'วันนี้': 'Today',
  'เมื่อวาน': 'Yesterday',
  'เมื่อสักครู่': 'Just now',
  '{n} นาที': '{n} min',
  '{n} ชม.': '{n} hr',
  '{n} วัน': '{n} d',
  'ล้างการแจ้งเตือน': 'Clear notifications',
  'ลบรายการแจ้งเตือนทั้งหมดออกจากระบบ': 'Delete all notifications permanently',
  'ล้างเลย': 'Clear',
  'ไม่พบการแจ้งเตือนที่ค้นหา': 'No results',
  'ยังไม่มีการแจ้งเตือน': 'No notifications yet',
  'ไม่มีรายการที่ตรงกับ "{q}"': 'Nothing matches "{q}"',
  'เมื่อคนในครอบครัวมีความเคลื่อนไหว\nจะแสดงที่นี่':
    "Your family's activity\nwill show up here",
  'เมื่อมีความเคลื่อนไหวของคุณ\nจะแสดงที่นี่': 'Your own activity\nwill show up here',

  // ---- หน้าแรก (HomeDashBoard) ----
  'สวัสดี {name}': 'Hi {name}',
  'เพื่อน': 'Friend',
  'ยังไม่ได้บันทึก': 'Not logged yet',
  'เริ่มต้นได้ดี': 'Good start',
  'กำลังไปได้สวย': 'On track',
  'ใกล้ถึงเป้า': 'Almost there',
  'เกินเป้าแล้ว': 'Over target',
  'เป้าหมาย': 'Goal',
  'เกินเป้า': 'Over by',
  'เหลืออีก': 'Remaining',
  'ครบเป้าหมายแล้ว': 'Goal reached',
  'เหลืออีก {n} ml': '{n} ml left',
  'ไม่ได้เพิ่มอาหารเข้า': 'Nothing added',
  'มื้อเช้า': 'Breakfast',
  'มื้อกลางวัน': 'Lunch',
  'มื้อเย็น': 'Dinner',
  'มื้อว่าง': 'Snack',

  // ---- เฟส 4.5: ข้อความที่ตกหล่น ----
  'โซนเป้าหมาย {min} – {max} kcal': 'Target zone {min} – {max} kcal',
  'เพิ่มครอบครัวของคุณ': 'Add your family',
  'มื้ออาหารวันนี้ ({count})': "Today's meals ({count})",
  '{n} แคลอรี่': '{n} kcal',
  '{count} สมาชิก · รหัส {code}': '{count} members · Code {code}',
  'ลบรายการอาหาร?': 'Delete meal item?',
  'ต้องการลบ "{name}" ออกจากมื้ออาหารใช่หรือไม่?': 'Do you want to delete "{name}" from meals?',
  'ลบรายการ': 'Delete',

  // ---- เฟส 5: หน้าแชท NutriBot (ChatScreen) ----
  'วันนี้ควรกินโปรตีนเท่าไหร่': 'How much protein should I eat today?',
  'แนะนำมื้อเย็นหน่อย': 'Suggest a dinner',
  'BMI ผมโอเคไหม': 'Is my BMI okay?',
  'ของว่างอะไรดี': 'What snack should I have?',
  'ยังไม่มีข้อความ — พิมพ์คำถามหรือเรื่องที่ต้องการสอบถาม แอดมินจะตอบกลับโดยเร็วที่สุด': 'No messages yet — type your question and an admin will reply as soon as possible',
  'แอดมิน': 'Admin',
  'ขออภัย เกิดข้อผิดพลาด ลองใหม่อีกครั้ง': 'Sorry, something went wrong. Please try again.',
  'ติดต่อสอบถาม admin': 'Contact admin',
  'ผู้ช่วยของ {name}': "{name}'s assistant",
  'คุณ': 'you',
  'กำลังโหลด...': 'Loading...',
  'kcal/วัน': 'kcal/day',
  'ติดต่อ Admin': 'Contact Admin',
  'ข้อความของคุณจะถูกส่งถึง Admin โดยตรง แยกจากบทสนทนากับ NutriBot': 'Your message goes straight to an Admin, separate from your NutriBot conversation',
  'ส่งข้อความถึง Admin...': 'Message an Admin...',
  'พิมพ์คำถาม...': 'Ask a question...',

  // ---- เฟส 6: หน้าวิเคราะห์เชิงลึก (InsightsScreen) ----
  'กำลังวิเคราะห์ข้อมูลของคุณ...': 'Analyzing your data...',
  'ดื่มน้ำได้ดี': 'Good hydration',
  'ดื่มน้ำเฉลี่ย {avg} ml/วัน ใกล้เคียงเป้าหมาย ({pct}% ของเป้า {target} ml) รักษาระดับนี้ไว้ต่อไปนะ': 'You average {avg} ml/day, close to your goal ({pct}% of {target} ml). Keep it up.',
  'ดื่มน้ำน้อยไป': 'Not enough water',
  'ดื่มน้ำเฉลี่ย {avg} ml/วัน ต่ำกว่าเป้าหมาย {short}% ควรตั้งเวลาเตือนดื่มน้ำทุก 1-2 ชั่วโมง': 'You average {avg} ml/day, {short}% below your goal. Try setting a reminder every 1-2 hours.',
  'วันที่ดีที่สุด': 'Best day',
  'วันที่ {day} กินได้ {cal} kcal ใกล้เคียงเป้าหมายที่สุด นี่คือวันตัวอย่างที่ดี': 'On day {day} you had {cal} kcal, the closest to your goal. A good day to repeat.',
  'ข้อมูลเชิงลึก': 'Insights',
  'ของ{name}': 'for {name}',
  'แคลอรี่รายวัน': 'Daily calories',
  'แคลอรี่รวม 7 วัน': '7-day total calories',
  'น้ำดื่มรวม 7 วัน': '7-day total water',
  'แนะนำให้ทำตาม': 'Recommended',
  'สิ่งที่ทำจริง': 'Actual',
  'บทวิเคราะห์สารอาหารของคุณ:': 'Your nutrient breakdown:',
  '• คุณทานคาร์โบไฮเดรตสูงกว่าเป้าหมาย ลองลดแป้งหรือน้ำตาลลงนิดนึงนะ': '• Your carbs are above target. Try cutting back a little on starch or sugar.',
  '• โปรตีนยังน้อยไปนิดนึง ลองเพิ่มเนื้อสัตว์, ไข่ หรือถั่วในมื้อถัดไป': '• Protein is a bit low. Try adding meat, eggs or beans to your next meal.',
  '• ปริมาณไขมันค่อนข้างสูง เลี่ยงของทอดหรือของมันในมื้อเย็นดูนะ': '• Fat is fairly high. Try avoiding fried or oily food at dinner.',
  '• เยี่ยมมาก! คุณรักษาสมดุลสารอาหารได้ดีมาก': '• Excellent! Your macros are well balanced.',
  'ยังไม่มีข้อมูลพอให้ AI วิเคราะห์ ลองบันทึกอาหารสัก 2-3 วันก่อนนะครับ': 'Not enough data to analyze yet. Try logging meals for 2-3 days first.',
  'เคล็ดลับสุขภาพวันนี้': "Today's health tip",
  'การดื่มน้ำ 1 แก้วทันทีหลังตื่นนอน ช่วยกระตุ้นระบบเผาผลาญและทำให้สมองตื่นตัวพร้อมรับวันใหม่!': 'A glass of water right after waking up kick-starts your metabolism and wakes up your brain for the day!',

  // ---- เฟส 7: ข้อความแจ้งเตือน (notificationRules) ----
  'ยังดื่มน้ำไม่ถึงเป้า': 'Behind on water',
  'ตอนนี้ควรดื่มได้ประมาณ {expected} ml แล้ว คุณดื่มไป {current} ml ขาดอีก {missing} ml': 'You should be at about {expected} ml by now. You have had {current} ml, {missing} ml to go.',
  'ยังไม่ได้บันทึก{meal}': '{meal} not logged',
  'อย่าลืมกิน{meal}และบันทึกลงแอปด้วยนะ': "Don't forget to eat and log your {meal}.",
  'วันนี้เหลืออีก {n} kcal อย่าลืมกินและบันทึกด้วยนะ': '{n} kcal left today. Remember to eat and log it.',
  'สรุปวันนี้': 'Daily summary',
  'กินไป {eaten} / {target} kcal · น้ำ {water} / {waterTarget} ml': 'Ate {eaten} / {target} kcal · Water {water} / {waterTarget} ml',
  ' ยังขาดน้ำอีก {n} ml ดื่มเพิ่มก่อนนอนได้นะ': ' {n} ml of water to go. Try to finish before bed.',
  ' วันนี้ดื่มน้ำครบเป้าแล้ว เยี่ยมมาก': ' You hit your water goal today. Nice work.',
  '{name} ยังดื่มน้ำไม่ถึงเป้า': '{name} is behind on water',
  'ตอนนี้ควรดื่มได้ประมาณ {expected} ml แล้ว {name} ดื่มไป {current} ml ขาดอีก {missing} ml': '{name} should be at about {expected} ml by now, but has had {current} ml. {missing} ml to go.',
  '{name} ยังไม่ได้บันทึก{meal}': '{name} has not logged {meal}',
  '{name} ยังไม่ได้บันทึก{meal}วันนี้ ลองทักไปถามดูไหม': '{name} has not logged {meal} today. Maybe check in with them?',
  '{name} กินเกินเป้าหมาย': '{name} is over their target',
  '{name} กินไป {eaten} kcal เกินเป้าไป {over} kcal แล้ววันนี้': '{name} has eaten {eaten} kcal, {over} kcal over target today.',
  'สมาชิกใหม่เข้าร่วมครอบครัว': 'New family member',
  '{name} เข้าร่วมครอบครัว "{family}" แล้ว': '{name} joined the family "{family}"',

  // ---- เฟส 8: หน้าสแกนอาหาร (ScanScreen) ----
  'อาหาร': 'Food',
  'บาร์โค้ด': 'Barcode',
  'ฉลากอาหาร': 'Label',
  'รูปภาพ': 'Gallery',
  'เช้า': 'Breakfast',
  'กลางวัน': 'Lunch',
  'เย็น': 'Dinner',
  'ขนม': 'Snack',
  'อาหารนี้มีโปรตีนสูง เหมาะสำหรับผู้ที่ต้องการเสริมสร้างกล้ามเนื้อ ควรรับประทานคู่กับผักหรือใยอาหารเพื่อสมดุลโภชนาการ': 'High in protein, good for building muscle. Pair it with vegetables or fibre for a balanced meal.',
  'อาหารนี้มีไขมันค่อนข้างสูง ควรรับประทานแต่พอดีและเลี่ยงการทานคู่กับอาหารไขมันสูงอื่น ๆ ในมื้อเดียวกัน': 'Fairly high in fat. Keep the portion moderate and avoid pairing it with other fatty dishes in the same meal.',
  'อาหารนี้มีคาร์โบไฮเดรตสูง เหมาะเป็นแหล่งพลังงานหลัก ควรทานคู่กับโปรตีนและผักเพื่อความสมดุล': 'High in carbs, a good main energy source. Pair it with protein and vegetables for balance.',
  'ลองทานคู่กับผักหรือผลไม้เพื่อเพิ่มใยอาหารและสารอาหารให้ครบถ้วนมากขึ้น': 'Try adding vegetables or fruit for more fibre and a fuller range of nutrients.',
  'ประมาณค่าพลังงานจากภาพที่ถ่าย ปริมาณและวิธีปรุงอาจส่งผลต่อความแม่นยำของค่าที่แสดง': 'Estimated from the photo. Portion size and cooking method can affect accuracy.',
  'ยังไม่มีข้อมูลโภชนาการ': 'No nutrition data',
  'จำได้ว่าเป็น "{name}" แต่ยังไม่มีข้อมูลโภชนาการในตาราง': 'Recognised as "{name}" but there is no nutrition data for it yet.',
  'วิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้ง': 'Analysis failed. Please try again.',
  'เร็ว ๆ นี้': 'Coming soon',
  'โหมดนี้กำลังพัฒนา ตอนนี้รองรับการสแกน "อาหาร" ก่อน': 'This mode is still in development. Only Food scanning is available for now.',
  'ถ่ายภาพไม่สำเร็จ ลองใหม่อีกครั้ง': 'Could not take the photo. Please try again.',
  'กรุณาเข้าสู่ระบบก่อนบันทึกอาหาร': 'Please log in before saving a meal.',
  'บันทึกสำเร็จ': 'Saved',
  'บันทึกมื้อ{meal}เรียบร้อยแล้ว': 'Your {meal} has been saved.',
  'อนุญาตให้ใช้กล้อง': 'Allow camera access',
  'AI กำลังวิเคราะห์อาหาร...': 'AI is analyzing your food...',
  'เลือกประเภทมื้อ': 'Choose meal type',
  'วันหมดอายุ': 'Expiry date',
  'เพิ่มเมื่อบรรจุภัณฑ์ระบุ': 'Add if shown on the packaging',
  'สแกนใหม่': 'Scan again',
  'บันทึก': 'Save',
  'ลองใหม่': 'Try again',
  'วิธีใช้งาน': 'How to use',
  'จัดอาหารให้อยู่ในกรอบ แล้วกดปุ่มวงกลมด้านล่างเพื่อถ่ายและวิเคราะห์แคลอรี่': 'Line the food up inside the frame, then tap the round button below to take a photo and analyze the calories.',
  'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง': 'Could not save. Please try again.',

  // ---- ลบแจ้งเตือนทีละรายการ (กดค้าง) ----
  'ลบรายการนี้': 'Delete this item',
  'ลบการแจ้งเตือนนี้ออกจากรายการ': 'Remove this notification from the list',
  'ลบ': 'Delete',

  // ---- หน้า Home ที่ยังขาดคำแปล (HomeDashBoard) ----
  'อรุณสวัสดิ์ {name}': 'Good morning, {name}',
  'สวัสดีตอนบ่าย {name}': 'Good afternoon, {name}',
  'สวัสดีตอนเย็น {name}': 'Good evening, {name}',
  'ราตรีสวัสดิ์ {name}': 'Good night, {name}',
  'แคลอรี่วันนี้': "Today's calories",
  'เพื่อดูของลูกที่คุณรัก': 'to look after your loved ones',
  'ยังไม่ได้บันทึกอะไรวันนี้': 'Nothing logged today',
  'เริ่มจากสแกนมื้อแรกเลย': 'Start by scanning your first meal',
  'สแกนเลย': 'Scan now',

  // ---- หน้าโปรไฟล์ + ข้อความทักทายของแชท ----
  'คู่มือการใช้งาน': 'User guide',
  'ต้องขออนุญาต': 'Permission needed',
  'กรุณาอนุญาตให้เข้าถึงคลังรูปภาพก่อน': 'Please allow access to your photo library first.',
  'สวัสดีครับ ผม NutriBot 🌿\nถามเรื่องอาหารหรือโภชนาการได้เลย ผมรู้ข้อมูลสุขภาพของคุณอยู่แล้ว':
    "Hi, I'm NutriBot 🌿\nAsk me anything about food or nutrition. I already know your health profile.",

  // ---- หน้า Pantry: การ์ดสรุป + เมนูแนะนำ (PantryScreen) ----
  'น้ำหนัก {weight} kg · BMI {bmi}': 'Weight {weight} kg · BMI {bmi}',
  'เป้าโปรตีน {n}g/วัน': 'Protein goal {n}g/day',
  'เป้าแคลอรี่/วัน': 'Calorie goal/day',
  'แคล': 'kcal',
  'รักษาสมดุล กินให้ครบห้าหมู่': 'Keep it balanced and eat from all five food groups',
  'น้ำหนักน้อยกว่าเกณฑ์': 'Underweight',
  'น้ำหนักปกติ': 'Normal weight',
  'น้ำหนักเกิน': 'Overweight',
  'อ้วนระดับ 1': 'Obese (class 1)',
  'อ้วนระดับ 2': 'Obese (class 2)',
  'กำลังคิดเมนูให้คุณ...': 'Finding menus for you...',
  'ยังไม่มีเมนูในหมวด "{category}" ใน Firestore\nเพิ่มเมนูผ่าน Firebase Console (collection "menus") ก่อนนะครับ':
    'No menus in "{category}" in Firestore yet.\nAdd menus via the Firebase Console ("menus" collection) first.',

  // ---- หน้า Pantry: ตู้เย็น (PantryScreen) ----
  'วัตถุดิบ': 'Ingredients',
  'ผัก/ผลไม้': 'Veg/Fruit',
  'ผัก': 'Vegetables',
  'ผลไม้': 'Fruit',
  'เนื้อ': 'Meat',
  'น้ำ': 'Drinks',
  'อื่นๆ': 'Others',
  'หมดอายุแล้ว': 'Expired',
  'หมดอายุวันนี้': 'Expires today',
  '{n} วันก่อนหมดอายุ': '{n} days left',
  'หมดอายุ {date}': 'Expires {date}',
  'วันหมดอายุ: น้อยไปมาก': 'Expiry: soonest first',
  'วันหมดอายุ: มากไปน้อย': 'Expiry: latest first',
  'ยังไม่มีวัตถุดิบในตู้เย็นเลย\nกด "+" มุมขวาบนเพื่อเพิ่มรายการแรก':
    'Your fridge is empty.\nTap "+" at the top right to add your first item.',
  'เพิ่มวัตถุดิบ/วันหมดอายุ': 'Add ingredient / expiry date',
  'รูปวัตถุดิบ': 'Ingredient photo',
  'ถ่ายรูป': 'Take photo',
  'เลือกจากคลัง': 'Choose from gallery',
  'ชื่อวัตถุดิบ': 'Ingredient name',
  'เช่น Sweet Potatoes, อกไก่': 'e.g. Sweet potatoes, chicken breast',
  'จำนวน': 'Amount',
  '*ไม่บังคับใส่': '*optional',
  'เช่น 600g หรือ 12 pcs': 'e.g. 600g or 12 pcs',
  'หมวดหมู่': 'Category',
  'แตะเพื่อเลือกวันที่': 'Tap to pick a date',
  'เสร็จสิ้น': 'Done',
  'เพิ่มเข้าตู้เย็น': 'Add to fridge',
  'ต้องอนุญาตกล้อง': 'Camera permission needed',
  'กรุณาอนุญาตการเข้าถึงกล้องในตั้งค่าเครื่อง': 'Please allow camera access in your phone settings.',
  'รูปใหญ่เกินไป': 'Photo too large',
  'กรุณาเลือกรูปอื่นหรือถ่ายใหม่ในมุมที่มีรายละเอียดน้อยกว่านี้':
    'Please choose another photo, or retake it with less detail in the frame.',
  'ประมวลผลรูปไม่สำเร็จ': 'Could not process the photo',
  'กรุณาเข้าสู่ระบบ': 'Please log in',
  'กรอกไม่ครบ': 'Missing information',
  'กรุณาใส่ชื่อวัตถุดิบ': 'Please enter an ingredient name.',
  'เลือกไม่ครบ': 'Missing selection',
  'กรุณาเลือกหมวดหมู่ของวัตถุดิบ': 'Please choose a category.',
  'เพิ่มไม่สำเร็จ': 'Could not add',
  'ลบรูปภาพ': 'Remove photo',
  'ลบรูปไม่สำเร็จ': 'Could not remove the photo',
  'ลบวัตถุดิบนี้ทั้งหมด': 'Remove this ingredient',
  'ลบไม่สำเร็จ': 'Could not delete',
  'เลือกการดำเนินการ': 'Choose an action',

  // ---- หน้าสูตรอาหาร (RecipeDetailScreen) ----
  'ง่าย': 'Easy',
  'ทำง่าย': 'Easy',
  'กลาง': 'Medium',
  'ปานกลาง': 'Medium',
  'ยาก': 'Hard',
  'ทำยาก': 'Hard',
  'กลุ่ม {n}': 'Group {n}',
  '{n}g โปรตีน': '{n}g protein',
  'วิธีการทำ': 'How to make',
  'แตะเพื่อเปิดวิดีโอ': 'Tap to open the video',
  'ยังไม่มีวิดีโอสำหรับเมนูนี้': 'No video for this menu yet',
  'เพิ่มเมนู': 'Add menu',
  'เพิ่มเมนูอีกครั้ง': 'Add again',
  'ยกเลิกที่เพิ่งเพิ่ม': 'Undo',
  'ต้องล็อกอินก่อนถึงจะเพิ่มเมนูได้': 'You need to log in before adding a menu.',
  'เพิ่มเมนูสำเร็จ!': 'Menu added!',
  'หักวัตถุดิบในตู้เย็น {n} รายการและบันทึกมื้อ{meal}เรียบร้อยแล้ว':
    'Used {n} fridge item(s) and saved your {meal}.',
  'เกิดข้อผิดพลาด': 'Something went wrong',
  'ยกเลิกรายการนี้?': 'Undo this entry?',
  'ต้องการยกเลิกมื้อ{meal} ({name}) ที่เพิ่งเพิ่มใช่หรือไม่?': 'Undo the {meal} ({name}) you just added?',
  'ไม่ยกเลิก': 'Keep it',
  'ยกเลิกรายการนี้': 'Undo',
  'ยกเลิกสำเร็จ': 'Undone',
  'ยกเลิกการเพิ่มเมนูและคืนค่าวัตถุดิบเรียบร้อยแล้ว': 'The menu was removed and your fridge items were restored.',
  'เกิดข้อผิดพลาดในการยกเลิก': 'Could not undo',
  'เลือกวัตถุดิบมาแทน': 'Choose a substitute',
  'เลือกวัตถุดิบที่จะใช้แทน': 'Choose what to use instead of',
  'ใช้วัตถุดิบอื่นที่ไม่ได้เพิ่มในตู้เย็น': 'Use something that is not in your fridge',
  'ระบุวัตถุดิบที่จะใช้แทน หรือใช้วัตถุดิบเดิมที่มีอยู่นอกตู้เย็น':
    'Enter a substitute, or use the original ingredient you have outside the fridge',
  'ระบุวัตถุดิบที่คุณจะใช้แทน "{name}"': 'What will you use instead of "{name}"?',
  'มี "{name}" อยู่แล้ว (ไม่ได้เพิ่มในตู้เย็น)': 'I already have "{name}" (not in the fridge)',
  'หรือพิมพ์ชื่อวัตถุดิบอื่น เช่น อกไก่, เต้าหู้...': 'Or type another ingredient, e.g. chicken breast, tofu...',
  'ใช้แทน': 'Use instead',
  'ยกเลิกการพิมพ์': 'Cancel',
  'เลือกจากในตู้เย็นของคุณ ({n} รายการ):': 'Pick from your fridge ({n} items):',
  'วัตถุดิบในตู้เย็น:': 'Fridge items:',
  'ไม่มีวัตถุดิบในตู้เย็นของคุณ\nกดปุ่มด้านบนเพื่อใช้วัตถุดิบนอกตู้เย็นได้ทันที':
    'Your fridge is empty.\nTap the button above to use an ingredient from outside the fridge.',
  'ปริมาณในตู้เย็น: {amount}': 'In fridge: {amount}',
  'ไม่ระบุปริมาณ': 'No amount set',
  'ยืนยันเพิ่มเมนู': 'Confirm menu',
  'เลือกวัตถุดิบที่จะหักออกจากตู้เย็นของคุณ': 'Choose which ingredients to take out of your fridge',
  'มีพอในตู้เย็น': 'Enough in the fridge',
  'มีในตู้เย็นไม่พอ': 'Not enough in the fridge',
  'คุณระบุว่ามีแล้ว (ไม่พบในตู้เย็น)': 'Marked as owned (not found in the fridge)',
  'ยังไม่มีในตู้เย็น': 'Not in the fridge',
  'มีวัตถุดิบนอกตู้เย็น (ไม้หักจากในตู้เย็น)': 'Have it outside the fridge (not deducted)',
  '(ใช้ {name} แทน)': '(using {name} instead)',
  '(มีอยู่นอกตู้เย็น)': '(have it outside the fridge)',
  'เหลือ {amount}': '{amount} left',
  'ใช้หมด': 'uses all of it',
  'เปลี่ยน': 'Change',
};

const TABLES = { en: EN };

// แทนที่ placeholder รูปแบบ {ชื่อ} ด้วยค่าใน vars
// เช่น fillVars('เหลืออีก {n} kcal', { n: 120 }) => 'เหลืออีก 120 kcal'
// ถ้าไม่มีค่าใน vars ก็คง {ชื่อ} ไว้เหมือนเดิม จะได้เห็นตอนเทสว่าลืมส่งอะไร
function fillVars(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => {
    const value = vars[name];
    return value === undefined || value === null ? match : String(value);
  });
}

// แปลข้อความ — ห้าม throw ไม่ว่ากรณีใด ถ้าอะไรผิดพลาดให้คืนค่าที่ปลอดภัยที่สุดแทน
export function translate(lang, key, vars) {
  if (typeof key !== 'string' || key === '') return '';

  try {
    const table = TABLES[lang];               // th ไม่มีตาราง เพราะเป็นต้นฉบับอยู่แล้ว
    const text = (table && table[key]) || key; // แปลไม่เจอ ก็ใช้ต้นฉบับไทยไปก่อน
    return fillVars(text, vars);
  } catch (e) {
    return key;
  }
}


// ---- ภาษาปัจจุบันแบบ module-level ----
// ไฟล์ที่ไม่ใช่ React component (เช่น notificationRules) เรียก useLang() ไม่ได้
// LanguageContext จะอัปเดตค่านี้ให้ทุกครั้งที่ภาษาเปลี่ยน แล้วที่นี่ก็อ่านผ่าน tt() ได้เลย
let currentLang = 'th';

export function setCurrentLang(l) {
  if (LANGUAGE_KEYS.includes(l)) currentLang = l;
}

export function tt(key, vars) {
  return translate(currentLang, key, vars);
}

// ── Unit Translation Dictionary ──
export const UNIT_TRANSLATIONS = {
  'กรัม': { singular: 'g', plural: 'g' },
  'กิโลกรัม': { singular: 'kg', plural: 'kg' },
  'ขีด': { singular: '100g', plural: '100g' },
  'ช้อนโต๊ะ': { singular: 'tbsp', plural: 'tbsp' },
  'ช้อนชา': { singular: 'tsp', plural: 'tsp' },
  'ถ้วย': { singular: 'cup', plural: 'cups' },
  'มล.': { singular: 'ml', plural: 'ml' },
  'ลิตร': { singular: 'L', plural: 'L' },
  'ชิ้น': { singular: 'piece', plural: 'pieces' },
  'ลูก': { singular: 'item', plural: 'items' },
  'ฟอง': { singular: 'egg', plural: 'eggs' },
  'มัด': { singular: 'bunch', plural: 'bunches' },
  'กลีบ': { singular: 'clove', plural: 'cloves' },
  'แผ่น': { singular: 'slice', plural: 'slices' },
  'ต้น': { singular: 'stalk', plural: 'stalks' },
  'ซอง': { singular: 'packet', plural: 'packets' },
  'หยิบมือ': { singular: 'pinch', plural: 'pinches' },
  'ตามชอบ': { singular: 'as desired', plural: 'as desired' },
  'ก้อน': { singular: 'block', plural: 'blocks' },
  'หลอด': { singular: 'tube', plural: 'tubes' },
  'ขวด': { singular: 'bottle', plural: 'bottles' },
  'กระป๋อง': { singular: 'can', plural: 'cans' },
  // หน่วยที่เจอในเมนูจริงแต่ตารางเดิมยังไม่มี
  'หัว': { singular: 'head', plural: 'heads' },
  'สกู๊ป': { singular: 'scoop', plural: 'scoops' },
  'ใบ': { singular: 'leaf', plural: 'leaves' },
  'กำ': { singular: 'handful', plural: 'handfuls' },
  'ฝัก': { singular: 'pod', plural: 'pods' },
  'เม็ด': { singular: 'piece', plural: 'pieces' },
  'ช้อน': { singular: 'spoon', plural: 'spoons' },
  'ถุง': { singular: 'bag', plural: 'bags' },
  'ก้าน': { singular: 'sprig', plural: 'sprigs' },
  'ช่อ': { singular: 'floret', plural: 'florets' },
  'ดอก': { singular: 'flower', plural: 'flowers' },
  'แท่ง': { singular: 'stick', plural: 'sticks' },
  'เส้น': { singular: 'strand', plural: 'strands' },
  'ห่อ': { singular: 'pack', plural: 'packs' },
  'กล่อง': { singular: 'box', plural: 'boxes' },
  'ราก': { singular: 'root', plural: 'roots' }
};

export function localizeAmount(amountStr, lang = 'th') {
  if (!amountStr || typeof amountStr !== 'string') return '';
  const s = amountStr.trim();
  if (!s || lang !== 'en') return s;

  const m = s.match(/^([\d\s.,/+\-]+?)\s*([^\d.,/+\-].*)?$/);
  if (!m) {
    const uInfo = UNIT_TRANSLATIONS[s];
    return uInfo ? uInfo.singular : s;
  }

  const numPart = (m[1] || '').trim();
  let unitPart = (m[2] || '').trim();
  if (!unitPart) return numPart;

  const uInfo = UNIT_TRANSLATIONS[unitPart];
  if (uInfo) {
    // ช่วงตัวเลข เช่น "1-2 ก้าน" นับเป็นพหูพจน์ ("1-2 sprigs")
    const isPlural = parseFloat(numPart) !== 1 || /[-–~]/.test(numPart);
    const enUnit = isPlural ? uInfo.plural : uInfo.singular;
    return `${numPart} ${enUnit}`.trim();
  }

  return s;
}
