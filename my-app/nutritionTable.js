// ตารางโภชนาการในเครื่อง — map "ชื่อ class จาก Roboflow" -> ข้อมูลโภชนาการโดยประมาณ (ต่อ 1 จาน/เสิร์ฟมาตรฐาน)
//
// สร้างจาก class_labels.csv ของโมเดลจริง (100 เมนูอาหารไทย)
// key เป็นเลข "0".."99" ตรงกับคอลัมน์ Directory_Name ในไฟล์ CSV
// เพราะโมเดล classification ที่เทรนจากโฟลเดอร์รูปมักใช้ "ชื่อโฟลเดอร์" เป็น class label ตรงๆ
//
// สำคัญ: ต้องเช็คให้ชัวร์ก่อนใช้จริง! ลองสแกนรูปจริงสักครั้ง แล้วดู log
// "Roboflow detected: ..." ใน console — ถ้า Roboflow ตอบเป็นตัวเลขตรงกับที่นี่ ใช้ได้เลย
// แต่ถ้า Roboflow ตอบเป็นชื่ออังกฤษ (เช่น "Phat_Thai") แทน ให้บอกแล้วผมจะแก้ key ให้ตรงใหม่
//
// ตัวเลขโภชนาการเป็นค่าประมาณต่อเสิร์ฟมาตรฐาน อาจคลาดเคลื่อนจากเมนูจริงได้ ปรับแก้ได้ตามต้องการ

export const NUTRITION_TABLE = {
  '0':  { name: 'ข้าวผัดอเมริกัน', calories: 650, protein: 20, carbs: 80, fat: 22 },
  '1':  { name: 'ข้าวหน้าไก่', calories: 480, protein: 28, carbs: 55, fat: 15 },
  '2':  { name: 'ปอเปี๊ยะทอด', calories: 320, protein: 6, carbs: 30, fat: 20 },
  '3':  { name: 'ผัดซีอิ๊ว', calories: 460, protein: 16, carbs: 60, fat: 16 },
  '4':  { name: 'กระเพาะปลาน้ำแดง', calories: 220, protein: 18, carbs: 15, fat: 9 },
  '5':  { name: 'ไส้กรอกอีสาน', calories: 300, protein: 14, carbs: 10, fat: 22 },
  '6':  { name: 'ลาบคั่ว', calories: 320, protein: 25, carbs: 12, fat: 18 },
  '7':  { name: 'ไก่ผัดเม็ดมะม่วงหิมพานต์', calories: 420, protein: 28, carbs: 20, fat: 24 },
  '8':  { name: 'ผัดพริกแกง', calories: 380, protein: 20, carbs: 15, fat: 24 },
  '9':  { name: 'ผัดพริกไทยดำ', calories: 350, protein: 22, carbs: 12, fat: 22 },
  '10': { name: 'ปลานึ่งซีอิ๊ว', calories: 220, protein: 28, carbs: 8, fat: 8 },
  '11': { name: 'ผัดแขนง', calories: 150, protein: 5, carbs: 12, fat: 9 },
  '12': { name: 'ไข่กระทะ', calories: 320, protein: 16, carbs: 10, fat: 24 },
  '13': { name: 'แกงจืด', calories: 150, protein: 12, carbs: 8, fat: 6 },
  '14': { name: 'ก๋วยเตี๋ยวเรือ', calories: 380, protein: 18, carbs: 50, fat: 10 },
  '15': { name: 'ไข่ตุ๋น', calories: 150, protein: 10, carbs: 4, fat: 10 },
  '16': { name: 'โรตี', calories: 300, protein: 6, carbs: 45, fat: 11 },
  '17': { name: 'หมูฮ้อง', calories: 380, protein: 22, carbs: 15, fat: 25 },
  '18': { name: 'น้ำพริกหนุ่ม', calories: 100, protein: 3, carbs: 12, fat: 4 },
  '19': { name: 'ผัดไทยห่อไข่', calories: 550, protein: 18, carbs: 65, fat: 24 },
  '20': { name: 'แกงเขียวหวาน', calories: 350, protein: 18, carbs: 15, fat: 24 },
  '21': { name: 'น้ำพริกอ่อง', calories: 180, protein: 10, carbs: 14, fat: 9 },
  '22': { name: 'ข้าวแช่', calories: 350, protein: 12, carbs: 55, fat: 9 },
  '23': { name: 'ข้าวคลุกกะปิ', calories: 480, protein: 18, carbs: 60, fat: 18 },
  '24': { name: 'ปลาหมึกทอด', calories: 320, protein: 20, carbs: 18, fat: 18 },
  '25': { name: 'คั่วกลิ้ง', calories: 350, protein: 25, carbs: 10, fat: 23 },
  '26': { name: 'ผัดคะน้า', calories: 180, protein: 10, carbs: 12, fat: 10 },
  '27': { name: 'ปลานึ่งมะนาว', calories: 200, protein: 28, carbs: 8, fat: 6 },
  '28': { name: 'ต้มข่า', calories: 280, protein: 16, carbs: 10, fat: 20 },
  '29': { name: 'ยำวุ้นเส้น', calories: 220, protein: 14, carbs: 22, fat: 9 },
  '30': { name: 'ปลาเผา', calories: 250, protein: 30, carbs: 2, fat: 13 },
  '31': { name: 'ปลาหมึกผัดน้ำดำ', calories: 300, protein: 22, carbs: 15, fat: 16 },
  '32': { name: 'เกี๊ยวทอด', calories: 300, protein: 8, carbs: 30, fat: 18 },
  '33': { name: 'กั้งทอดกระเทียม', calories: 280, protein: 24, carbs: 10, fat: 16 },
  '34': { name: 'ผัดผักบุ้งไฟแดง', calories: 150, protein: 6, carbs: 12, fat: 9 },
  '35': { name: 'เต้าหู้ทอด', calories: 250, protein: 12, carbs: 15, fat: 16 },
  '36': { name: 'ยำหอย', calories: 200, protein: 18, carbs: 14, fat: 8 },
  '37': { name: 'สุกี้แห้ง', calories: 400, protein: 22, carbs: 35, fat: 18 },
  '38': { name: 'กุ้งทอด', calories: 280, protein: 22, carbs: 18, fat: 14 },
  '39': { name: 'ปอเปี๊ยะสด', calories: 150, protein: 8, carbs: 22, fat: 3 },
  '40': { name: 'ผัดพริกสด', calories: 320, protein: 20, carbs: 12, fat: 20 },
  '41': { name: 'แกงฮังเล', calories: 400, protein: 22, carbs: 18, fat: 26 },
  '42': { name: 'ขนมจีบ', calories: 250, protein: 12, carbs: 20, fat: 13 },
  '43': { name: 'ก๋วยเตี๋ยวคั่วไก่', calories: 450, protein: 22, carbs: 55, fat: 15 },
  '44': { name: 'ปูนิ่มทอดกระเทียม', calories: 320, protein: 22, carbs: 18, fat: 18 },
  '45': { name: 'กะหล่ำปลีผัดน้ำปลา', calories: 130, protein: 5, carbs: 12, fat: 7 },
  '46': { name: 'ข้าวหมกไก่', calories: 550, protein: 28, carbs: 65, fat: 20 },
  '47': { name: 'ผัดกะปิ', calories: 350, protein: 18, carbs: 15, fat: 22 },
  '48': { name: 'ไส้อั่ว', calories: 320, protein: 16, carbs: 8, fat: 25 },
  '49': { name: 'ยำปลาดุกฟู', calories: 280, protein: 20, carbs: 18, fat: 15 },
  '50': { name: 'หอยทอด', calories: 400, protein: 14, carbs: 30, fat: 24 },
  '51': { name: 'ผัดกะเพรา', calories: 480, protein: 25, carbs: 35, fat: 26 },
  '52': { name: 'ข้าวสวย', calories: 200, protein: 4, carbs: 44, fat: 0 },
  '53': { name: 'หอยจ๊อ', calories: 280, protein: 14, carbs: 20, fat: 16 },
  '54': { name: 'หอยผัดน้ำพริกเผา', calories: 300, protein: 20, carbs: 14, fat: 18 },
  '55': { name: 'ข้าวขาหมู', calories: 550, protein: 25, carbs: 60, fat: 22 },
  '56': { name: 'แกงคั่วหอย', calories: 320, protein: 20, carbs: 14, fat: 21 },
  '57': { name: 'ข้าวต้ม', calories: 180, protein: 8, carbs: 32, fat: 3 },
  '58': { name: 'ข้าวหมูแดง', calories: 480, protein: 22, carbs: 60, fat: 16 },
  '59': { name: 'พะโล้', calories: 400, protein: 22, carbs: 20, fat: 25 },
  '60': { name: 'คั่วพริกเกลือ', calories: 300, protein: 20, carbs: 10, fat: 19 },
  '61': { name: 'ราดหน้า', calories: 430, protein: 18, carbs: 55, fat: 14 },
  '62': { name: 'เต้าเจี้ยวหลน', calories: 220, protein: 10, carbs: 16, fat: 13 },
  '63': { name: 'เย็นตาโฟ', calories: 380, protein: 18, carbs: 45, fat: 13 },
  '64': { name: 'ปลาหมึกนึ่งมะนาว', calories: 200, protein: 25, carbs: 8, fat: 6 },
  '65': { name: 'แกงป่า', calories: 250, protein: 20, carbs: 10, fat: 14 },
  '66': { name: 'โจ๊ก', calories: 200, protein: 10, carbs: 30, fat: 5 },
  '67': { name: 'ขนมจีนน้ำเงี้ยว', calories: 400, protein: 18, carbs: 50, fat: 13 },
  '68': { name: 'ก๋วยจั๊บ', calories: 350, protein: 16, carbs: 40, fat: 12 },
  '69': { name: 'แกงส้ม', calories: 200, protein: 16, carbs: 12, fat: 9 },
  '70': { name: 'หอยนางรม', calories: 150, protein: 14, carbs: 8, fat: 6 },
  '71': { name: 'ขนมจีน', calories: 250, protein: 6, carbs: 52, fat: 1 },
  '72': { name: 'แกงเหลือง', calories: 220, protein: 16, carbs: 12, fat: 10 },
  '73': { name: 'กุ้งแช่น้ำปลา', calories: 180, protein: 22, carbs: 6, fat: 6 },
  '74': { name: 'กุ้งทอดซอสมะขาม', calories: 320, protein: 22, carbs: 28, fat: 14 },
  '75': { name: 'หมูกรอบ', calories: 450, protein: 22, carbs: 5, fat: 38 },
  '76': { name: 'ปูผัดผงกะหรี่', calories: 380, protein: 26, carbs: 16, fat: 23 },
  '77': { name: 'ไข่เจียว', calories: 220, protein: 12, carbs: 2, fat: 18 },
  '78': { name: 'กุ้งอบวุ้นเส้น', calories: 350, protein: 22, carbs: 38, fat: 11 },
  '79': { name: 'ผัดฉ่า', calories: 380, protein: 22, carbs: 14, fat: 25 },
  '80': { name: 'หอยแครงลวก', calories: 120, protein: 16, carbs: 4, fat: 4 },
  '81': { name: 'ห่อหมก', calories: 300, protein: 20, carbs: 10, fat: 19 },
  '82': { name: 'ปลาหมึกผัดไข่เค็ม', calories: 380, protein: 22, carbs: 14, fat: 25 },
  '83': { name: 'ผัดไทย', calories: 486, protein: 15, carbs: 66, fat: 18 },
  '84': { name: 'ทอดมันกุ้ง', calories: 280, protein: 16, carbs: 20, fat: 15 },
  '85': { name: 'สะเต๊ะ', calories: 300, protein: 22, carbs: 14, fat: 18 },
  '86': { name: 'ข้าวมันไก่', calories: 550, protein: 26, carbs: 65, fat: 20 },
  '87': { name: 'ไก่ทอด', calories: 400, protein: 28, carbs: 15, fat: 26 },
  '88': { name: 'ลาบ', calories: 250, protein: 22, carbs: 10, fat: 14 },
  '89': { name: 'ใบเหลียงผัดไข่', calories: 180, protein: 10, carbs: 8, fat: 12 },
  '90': { name: 'ข้าวซอย', calories: 500, protein: 20, carbs: 50, fat: 24 },
  '91': { name: 'เกาเหลา', calories: 200, protein: 18, carbs: 8, fat: 9 },
  '92': { name: 'ทอดมันปลา', calories: 260, protein: 16, carbs: 20, fat: 13 },
  '93': { name: 'ปูนึ่ง', calories: 150, protein: 25, carbs: 2, fat: 5 },
  '94': { name: 'หมูย่าง', calories: 300, protein: 28, carbs: 4, fat: 19 },
  '95': { name: 'ส้มตำ', calories: 120, protein: 4, carbs: 22, fat: 2 },
  '96': { name: 'กุ้งเผา', calories: 180, protein: 26, carbs: 2, fat: 7 },
  '97': { name: 'ข้าวผัด', calories: 420, protein: 12, carbs: 60, fat: 14 },
  '98': { name: 'ต้มยำ', calories: 180, protein: 20, carbs: 10, fat: 6 },
  '99': { name: 'ปลาทอด', calories: 280, protein: 26, carbs: 10, fat: 15 },
};

// แผนที่ alias สำหรับแปลงชื่อภาษาอังกฤษ / รูปแบบเขียนต่างกัน จาก Roboflow -> key ใน NUTRITION_TABLE
const ALIAS_MAP = {
  // 0
  'Khao Phat Amerikan': '0', 'khaophatamerikan': '0', 'ข้าวผัดอเมริกัน': '0',
  // 1
  'Khao Na Kai': '1', 'khaonakai': '1', 'ข้าวหน้าไก่': '1',
  // 2
  'Po Pia Thot': '2', 'popiathot': '2', 'ปอเปี๊ยะทอด': '2',
  // 3
  'Phat See Ew': '3', 'phatseeew': '3', 'ผัดซีอิ๊ว': '3',
  // 4
  'Krapo Pla Nam Dang': '4', 'krapoplanamgdang': '4', 'กระเพาะปลาน้ำแดง': '4',
  // 5
  'Sai Krok Isan': '5', 'saikrokisan': '5', 'ไส้กรอกอีสาน': '5',
  // 6
  'Lap Kua': '6', 'lapkua': '6', 'ลาบคั่ว': '6',
  // 7
  'Gai Phat Med Mamuang Himmapan': '7', 'gaiphatmedmamuanghimmapan': '7', 'ไก่ผัดเม็ดมะม่วงหิมพานต์': '7',
  // 8
  'Phat Prik Gang': '8', 'phatprikgang': '8', 'ผัดพริกแกง': '8',
  // 9
  'Phat Prik Thai Dam': '9', 'phatprikthaidam': '9', 'ผัดพริกไทยดำ': '9',
  // 10
  'Pla Nueng See Ew': '10', 'planuengseeew': '10', 'ปลานึ่งซีอิ๊ว': '10',
  // 11
  'Phat Khanaeng': '11', 'phatkhanaeng': '11', 'ผัดแขนง': '11',
  // 12
  'Khai Krata': '12', 'khaikrata': '12', 'ไข่กระทะ': '12',
  // 13
  'Kang Chued': '13', 'kangchued': '13', 'แกงจืด': '13',
  // 14
  'Kuaitiao Ruea': '14', 'kuaitiaoruea': '14', 'ก๋วยเตี๋ยวเรือ': '14',
  // 15
  'Khai Tun': '15', 'khaitun': '15', 'ไข่ตุ๋น': '15',
  // 16
  'Roti': '16', 'roti': '16', 'โรตี': '16',
  // 17
  'Mu Hong': '17', 'muhong': '17', 'หมูฮ้อง': '17',
  // 18
  'Nam Prik Num': '18', 'nampriknum': '18', 'น้ำพริกหนุ่ม': '18',
  // 19
  'Phat Thai Ho Khai': '19', 'phatthaihokhai': '19', 'ผัดไทยห่อไข่': '19',
  // 20
  'Kaeng Khiao Wan': '20', 'kaengkhiaowan': '20', 'แกงเขียวหวาน': '20',
  // 21
  'Nam Prik Ong': '21', 'namprikong': '21', 'น้ำพริกอ่อง': '21',
  // 22
  'Khao Chae': '22', 'khaochae': '22', 'ข้าวแช่': '22',
  // 23
  'Khao Kluk Kapi': '23', 'khaoklukkapi': '23', 'ข้าวคลุกกะปิ': '23',
  // 24
  'Pla Muek Thot': '24', 'plamuekthot': '24', 'ปลาหมึกทอด': '24',
  // 25
  'Kua Kling': '25', 'kuakling': '25', 'คั่วกลิ้ง': '25',
  // 26
  'Phat Kana': '26', 'phatkana': '26', 'ผัดคะน้า': '26',
  // 27
  'Pla Nueng Manao': '27', 'planuengmanao': '27', 'ปลานึ่งมะนาว': '27',
  // 28
  'Tom Kha': '28', 'tomkha': '28', 'ต้มข่า': '28',
  // 29
  'Yam Woon Sen': '29', 'yamwoonsen': '29', 'ยำวุ้นเส้น': '29',
  // 30
  'Pla Phao': '30', 'plaphao': '30', 'ปลาเผา': '30',
  // 31
  'Pla Muek Phat Nam Dam': '31', 'plamuekphatnamdam': '31', 'ปลาหมึกผัดน้ำดำ': '31',
  // 32
  'Kiao Thot': '32', 'kiaothot': '32', 'เกี๊ยวทอด': '32',
  // 33
  'Kang Thot Kratiam': '33', 'kangkhotkratiam': '33', 'กั้งทอดกระเทียม': '33',
  // 34
  'Phat Pak Bung Fai Daeng': '34', 'phatpakbungfaidaeng': '34', 'ผัดผักบุ้งไฟแดง': '34',
  // 35
  'Tao Hoo Thot': '35', 'taohoothot': '35', 'เต้าหู้ทอด': '35',
  // 36
  'Yam Hoi': '36', 'yamhoi': '36', 'ยำหอย': '36',
  // 37
  'Suki Haeng': '37', 'sukihaeng': '37', 'sukihang': '37', 'สุกี้แห้ง': '37',
  // 38
  'Kung Thot': '38', 'kungthot': '38', 'กุ้งทอด': '38',
  // 39
  'Po Pia Sod': '39', 'popiasod': '39', 'ปอเปี๊ยะสด': '39',
  // 40
  'Phat Prik Sod': '40', 'phatpriksod': '40', 'ผัดพริกสด': '40',
  // 41
  'Kaeng Hang Le': '41', 'kaenghangle': '41', 'แกงฮังเล': '41',
  // 42
  'Khanom Cheeb': '42', 'khanomcheeb': '42', 'ขนมจีบ': '42',
  // 43
  'Kuaitiao Kua Kai': '43', 'kuatiaokuakai': '43', 'ก๋วยเตี๋ยวคั่วไก่': '43',
  // 44
  'Pu Nim Thot Kratiam': '44', 'punimthotkratiam': '44', 'ปูนิ่มทอดกระเทียม': '44',
  // 45
  'Kalampli Phat Nam Pla': '45', 'kalampliphatnampla': '45', 'กะหล่ำปลีผัดน้ำปลา': '45',
  // 46
  'Khao Mok Kai': '46', 'khaomokkai': '46', 'khaomokgai': '46', 'ข้าวหมกไก่': '46',
  // 47
  'Phat Kapi': '47', 'phatkapi': '47', 'ผัดกะปิ': '47',
  // 48
  'Sai Ua': '48', 'saiua': '48', 'ไส้อั่ว': '48',
  // 49
  'Yam Pla Duk Fu': '49', 'yampladufu': '49', 'ยำปลาดุกฟู': '49',
  // 50
  'Hoi Thot': '50', 'hoithot': '50', 'หอยทอด': '50',
  // 51
  'Phat Kaprao': '51', 'phatkaprao': '51', 'padkaprao': '51', 'padkrapao': '51',
  'phatkaphrao': '51', 'kaprao': '51', 'ผัดกะเพรา': '51',
  // 52
  'Khao Suai': '52', 'khaosuai': '52', 'ข้าวสวย': '52',
  // 53
  'Hoi Cho': '53', 'hoicho': '53', 'หอยจ๊อ': '53',
  // 54
  'Hoi Phat Nam Prik Phao': '54', 'hoiphatnamprikphao': '54', 'หอยผัดน้ำพริกเผา': '54',
  // 55
  'Khao Kha Mu': '55', 'khaomkamu': '55', 'khaokhamoo': '55', 'ข้าวขาหมู': '55',
  // 56
  'Kaeng Kua Hoi': '56', 'kaengkuahoi': '56', 'แกงคั่วหอย': '56',
  // 57
  'Khao Tom': '57', 'khaotom': '57', 'ข้าวต้ม': '57',
  // 58
  'Khao Mu Daeng': '58', 'khaomudaeng': '58', 'khaomoodang': '58', 'ข้าวหมูแดง': '58',
  // 59
  'Palo': '59', 'palo': '59', 'พะโล้': '59',
  // 60
  'Kua Prik Kluea': '60', 'kuaprikkluea': '60', 'คั่วพริกเกลือ': '60',
  // 61
  'Rat Na': '61', 'ratna': '61', 'ราดหน้า': '61',
  // 62
  'Tao Jiao Lon': '62', 'taojiaolon': '62', 'เต้าเจี้ยวหลน': '62',
  // 63
  'Yentafo': '63', 'yentafo': '63', 'เย็นตาโฟ': '63',
  // 64
  'Pla Muek Ngueng Manao': '64', 'plamuekanguengmanao': '64', 'ปลาหมึกนึ่งมะนาว': '64',
  // 65
  'Kaeng Pa': '65', 'kaengpa': '65', 'แกงป่า': '65',
  // 66
  'Chok': '66', 'chok': '66', 'โจ๊ก': '66',
  // 67
  'Khanom Cheen Nam Ngiao': '67', 'khanomcheennamngiao': '67', 'ขนมจีนน้ำเงี้ยว': '67',
  // 68
  'Kuaichap': '68', 'kuaichap': '68', 'ก๋วยจั๊บ': '68',
  // 69
  'Kaeng Som': '69', 'kaengsom': '69', 'แกงส้ม': '69',
  // 70
  'Hoi Nangrom': '70', 'hoinangrom': '70', 'หอยนางรม': '70',
  // 71
  'Khanom Cheen': '71', 'khanomcheen': '71', 'ขนมจีน': '71',
  // 72
  'Kaeng Lueang': '72', 'kaenglueang': '72', 'แกงเหลือง': '72',
  // 73
  'Kung Chae Nam Pla': '73', 'kungchaenampla': '73', 'กุ้งแช่น้ำปลา': '73',
  // 74
  'Kung Thot Sot Makham': '74', 'kungthotsotmakham': '74', 'กุ้งทอดซอสมะขาม': '74',
  // 75
  'Mu Krop': '75', 'mukrop': '75', 'หมูกรอบ': '75',
  // 76
  'Pu Phat Phong Kari': '76', 'puphatphongkari': '76', 'ปูผัดผงกะหรี่': '76',
  // 77
  'Khai Chiao': '77', 'khaichiao': '77', 'ไข่เจียว': '77',
  // 78
  'Kung Ob Wunsen': '78', 'kungobwunsen': '78', 'กุ้งอบวุ้นเส้น': '78',
  // 79
  'Phat Cha': '79', 'phatcha': '79', 'ผัดฉ่า': '79',
  // 80
  'Hoi Kraeng Luak': '80', 'hoikraengluak': '80', 'หอยแครงลวก': '80',
  // 81
  'Ho Mok': '81', 'homok': '81', 'ห่อหมก': '81',
  // 82
  'Pla Muek Phat Kai Kem': '82', 'plamuekphatkaikem': '82', 'ปลาหมึกผัดไข่เค็ม': '82',
  // 83
  'Phat Thai': '83', 'phatthai': '83', 'padthai': '83', 'ผัดไทย': '83',
  // 84
  'Thot Man Kung': '84', 'thotmankung': '84', 'ทอดมันกุ้ง': '84',
  // 85
  'Sate': '85', 'sate': '85', 'สะเต๊ะ': '85',
  // 86
  'Khao Man Kai': '86', 'khaomankai': '86', 'khaomangai': '86', 'ข้าวมันไก่': '86',
  // 87
  'Kai Thot': '87', 'kaithot': '87', 'ไก่ทอด': '87',
  // 88
  'Lap': '88', 'lap': '88', 'ลาบ': '88',
  // 89
  'Bai Liang Phat Khai': '89', 'baillangphatkhai': '89', 'ใบเหลียงผัดไข่': '89',
  // 90
  'Khao Soi': '90', 'khaosoi': '90', 'ข้าวซอย': '90',
  // 91
  'Kao Lao': '91', 'kaolao': '91', 'เกาเหลา': '91',
  // 92
  'Thot Man Pla': '92', 'thotmanpla': '92', 'ทอดมันปลา': '92',
  // 93
  'Pu Nueng': '93', 'punueng': '93', 'ปูนึ่ง': '93',
  // 94
  'Mu Yang': '94', 'muyang': '94', 'หมูย่าง': '94',
  // 95
  'Som Tam': '95', 'somtam': '95', 'somtum': '95', 'ส้มตำ': '95',
  // 96
  'Kung Phao': '96', 'kungphao': '96', 'กุ้งเผา': '96',
  // 97
  'Khao Phat': '97', 'khaophat': '97', 'khaopad': '97', 'ข้าวผัด': '97',
  // 98
  'Tom Yam': '98', 'tomyam': '98', 'tomyum': '98', 'ต้มยำ': '98',
  // 99
  'Pla Thot': '99', 'plathot': '99', 'ปลาทอด': '99',
};


function normalizeKey(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
}

/**
 * ค้นหาข้อมูลโภชนาการจาก class ที่ Roboflow ตอบกลับมา
 * รองรับทั้งกรณีเป็นตัวเลข ("51"), ชื่อภาษาอังกฤษ ("Phat Kaprao"), หรือภาษาไทย
 * คืนค่า null ถ้าไม่พบในตาราง
 */
export function lookupNutrition(className) {
  if (!className) return null;
  const rawKey = String(className).trim();

  // 1. ค้นหาตรงๆ จาก key ใน NUTRITION_TABLE
  if (NUTRITION_TABLE[rawKey]) {
    return NUTRITION_TABLE[rawKey];
  }

  // 2. แปลงเป็น normalized key (ตัดช่องว่าง/สัญลักษณ์/ตัวพิมพ์เล็ก)
  const normKey = normalizeKey(rawKey);

  // 3. ค้นหาจาก ALIAS_MAP
  if (ALIAS_MAP[normKey]) {
    const targetKey = ALIAS_MAP[normKey];
    if (NUTRITION_TABLE[targetKey]) {
      return NUTRITION_TABLE[targetKey];
    }
  }

  // 4. ค้นหาแบบยืดหยุ่นเปรียบเทียบชื่อเมนู
  for (const [k, item] of Object.entries(NUTRITION_TABLE)) {
    if (k === rawKey || normalizeKey(k) === normKey || normalizeKey(item.name) === normKey) {
      return item;
    }
  }

  return null;
}