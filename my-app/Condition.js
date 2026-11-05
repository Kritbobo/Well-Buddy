import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// เนื้อหาข้อกำหนดและเงื่อนไข แยกเป็น array เพื่อให้แก้ไข/เพิ่มหัวข้อได้ง่ายในอนาคต
// โดยไม่ต้องแตะโครงสร้าง component
const TERMS_SECTIONS = [
  {
    title: '1. การยอมรับข้อกำหนด',
    body: 'การใช้งานแอปพลิเคชัน WellBuddy ถือว่าผู้ใช้ได้อ่านและยอมรับข้อกำหนดและเงื่อนไขฉบับนี้ทุกประการ หากไม่ยอมรับกรุณาหยุดใช้งานแอปพลิเคชัน',
  },
  {
    title: '2. วัตถุประสงค์ของแอปพลิเคชัน',
    body: 'WellBuddy พัฒนาขึ้นเพื่อเป็นผู้ช่วยดูแลสุขภาพเบื้องต้นเท่านั้น ข้อมูลทั้งหมดที่แสดงในแอปพลิเคชัน ไม่ว่าจะเป็นการวิเคราะห์โภชนาการ ค่า BMI/TDEE หรือคำแนะนำด้านสุขภาพ ใช้สำหรับประกอบการตัดสินใจเบื้องต้นเท่านั้น ไม่สามารถใช้แทนคำแนะนำหรือการวินิจฉัยจากแพทย์หรือผู้เชี่ยวชาญด้านสุขภาพได้',
  },
  {
    title: '3. ข้อจำกัดความรับผิดชอบด้านสุขภาพ',
    body: 'ผลการวิเคราะห์จาก AI ในแอปพลิเคชัน เช่น การประเมินแคลอรี่จากรูปภาพอาหาร การอ่านฉลากโภชนาการ และการตอบคำถามผ่านแชทบอท เป็นการประมาณการเบื้องต้นเท่านั้น ค่าที่แสดงอาจมีความคลาดเคลื่อนได้ขึ้นอยู่กับปัจจัยต่าง ๆ เช่น ปริมาณอาหาร วิธีการปรุง และคุณภาพของรูปภาพ ทีมผู้พัฒนาไม่รับผิดชอบต่อความเสียหายใด ๆ ที่เกิดจากการนำข้อมูลในแอปไปใช้โดยไม่ปรึกษาผู้เชี่ยวชาญ',
  },
  {
    title: '4. การเก็บรวบรวมและใช้ข้อมูลส่วนบุคคล',
    body: 'แอปพลิเคชันจะเก็บข้อมูลที่จำเป็นต่อการให้บริการ ได้แก่ ชื่อ อีเมล น้ำหนัก ส่วนสูง อายุ เพศ และประวัติการบันทึกอาหาร โดยข้อมูลเหล่านี้จะถูกเก็บรักษาอย่างปลอดภัยบน Firebase และจะไม่ถูกเปิดเผยต่อบุคคลภายนอกโดยไม่ได้รับความยินยอมจากผู้ใช้ ทั้งนี้ ข้อมูลสุขภาพถือเป็นข้อมูลส่วนบุคคลที่มีความอ่อนไหว การเก็บและใช้ข้อมูลดังกล่าวจะดำเนินการภายใต้ความยินยอมของผู้ใช้เท่านั้น',
  },
  {
    title: '5. สิทธิ์การเข้าถึงข้อมูลในครอบครัว',
    body: 'ผู้ใช้ที่เชื่อมโยงบัญชีในกลุ่มครอบครัวยินยอมให้สมาชิกในกลุ่มเดียวกันสามารถดูข้อมูลสุขภาพของตนได้แบบอ่านอย่างเดียว (Read-only)',
  },
  {
    title: '6. คุณสมบัติของผู้ใช้งาน',
    body: 'ผู้ใช้งานต้องมีอายุตั้งแต่ 13 ปีขึ้นไปจึงจะสามารถสมัครใช้งานแอปพลิเคชันด้วยตนเองได้ หากผู้ใช้มีอายุต่ำกว่าเกณฑ์ดังกล่าว จำเป็นต้องได้รับความยินยอมจากผู้ปกครองหรือผู้แทนโดยชอบธรรม และให้ใช้งานผ่านบัญชีกลุ่มครอบครัวเท่านั้น',
  },
  {
    title: '7. สิทธิและหน้าที่ของผู้ใช้',
    body: 'ผู้ใช้ตกลงที่จะให้ข้อมูลที่เป็นจริงและเป็นปัจจุบันในการใช้งานแอปพลิเคชัน และมีหน้าที่รักษาความปลอดภัยของบัญชีผู้ใช้ของตนเอง รวมถึงรหัสผ่านและอุปกรณ์ที่ใช้เข้าสู่ระบบ หากพบการใช้งานที่ผิดปกติ ผู้ใช้ควรแจ้งทีมผู้พัฒนาโดยทันที',
  },
  {
    title: '8. ข้อจำกัดในการใช้งาน',
    body: 'ผู้ใช้ต้องไม่ทำการคัดลอก ทำวิศวกรรมย้อนกลับ (Reverse Engineering) ดัดแปลง หรือนำส่วนหนึ่งส่วนใดของแอปพลิเคชันไปใช้ในทางที่ผิดกฎหมายหรือละเมิดสิทธิ์ของผู้อื่น รวมถึงห้ามใช้บัญชีผู้ใช้ร่วมกับบุคคลอื่นโดยไม่ได้รับอนุญาตจากทีมผู้พัฒนา',
  },
  {
    title: '9. ทรัพย์สินทางปัญญา',
    body: 'เนื้อหา โลโก้ อัลกอริทึม และองค์ประกอบทั้งหมดภายในแอปพลิเคชัน WellBuddy ถือเป็นทรัพย์สินทางปัญญาของทีมผู้พัฒนา ห้ามทำซ้ำ ดัดแปลง หรือเผยแพร่โดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร',
  },
  {
    title: '10. สิทธิของเจ้าของข้อมูลส่วนบุคคล',
    body: 'ผู้ใช้มีสิทธิ์ขอเข้าถึง แก้ไข ลบ หรือถอนความยินยอมในการเก็บรวบรวม ใช้ หรือเปิดเผยข้อมูลส่วนบุคคลของตนได้ตลอดเวลา ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) โดยสามารถติดต่อทีมผู้พัฒนาผ่านช่องทางที่ระบุไว้ในข้อ 14',
  },
  {
    title: '11. การระงับหรือยกเลิกบัญชี',
    body: 'ทีมผู้พัฒนาขอสงวนสิทธิ์ในการระงับหรือยกเลิกบัญชีผู้ใช้ที่ฝ่าฝืนข้อกำหนดและเงื่อนไขฉบับนี้ หรือมีพฤติกรรมที่ก่อให้เกิดความเสียหายต่อแอปพลิเคชันหรือผู้ใช้งานรายอื่น โดยไม่จำเป็นต้องแจ้งล่วงหน้า',
  },
  {
    title: '12. การเปลี่ยนแปลงข้อกำหนดและเงื่อนไข',
    body: 'ทีมผู้พัฒนาอาจปรับปรุงหรือเปลี่ยนแปลงข้อกำหนดและเงื่อนไขนี้เป็นครั้งคราว โดยจะแจ้งให้ผู้ใช้ทราบผ่านการแจ้งเตือนภายในแอปพลิเคชัน การใช้งานแอปพลิเคชันต่อไปหลังจากมีการเปลี่ยนแปลง ถือว่าผู้ใช้ยอมรับข้อกำหนดฉบับใหม่',
  },
  {
    title: '13. กฎหมายที่ใช้บังคับ',
    body: 'ข้อกำหนดและเงื่อนไขฉบับนี้อยู่ภายใต้บังคับของกฎหมายแห่งราชอาณาจักรไทย',
  },
  {
    title: '14. ช่องทางติดต่อ',
    body: 'หากมีข้อสงสัยเกี่ยวกับข้อกำหนดและเงื่อนไข หรือต้องการใช้สิทธิ์เกี่ยวกับข้อมูลส่วนบุคคล สามารถติดต่อทีมผู้พัฒนาได้ที่ support@wellbuddy.app', // TODO: เปลี่ยนเป็นอีเมลติดต่อจริงของทีม
  },
];

export default function Condition({ navigation }) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);

  // เก็บตำแหน่ง scroll ปัจจุบัน เพื่อโชว์/ซ่อนปุ่มเลื่อนขึ้น-ลงให้เหมาะกับสถานะ
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);

  const handleScroll = (e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    setAtTop(contentOffset.y <= 4);
    setAtBottom(
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 4
    );
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 },
      ]}
    >
      {/* แถวบน: ย้อนกลับ */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* หัวข้อ */}
      <Text style={styles.title}>
        <Text style={styles.titleGreen}>ข้อกำหนด</Text>และเงื่อนไข
      </Text>
      <Text style={styles.subtitle}>
        โปรดอ่านและทำความเข้าใจก่อนใช้งาน WellBuddy
      </Text>

      {/* เนื้อหาที่เลื่อนได้ */}
      <View style={{ flex: 1, marginTop: 20 }}>
        <ScrollView
          ref={scrollRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {TERMS_SECTIONS.map((section, idx) => (
            <View key={idx} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}

          <Text style={styles.updatedText}>ปรับปรุงล่าสุด: 16 กรกฎาคม 2569</Text>
        </ScrollView>

        {/* ปุ่มเลื่อนขึ้น/ลง ลอยมุมขวาล่าง — ซ่อนอัตโนมัติเมื่อเลื่อนถึงสุดแล้ว */}
        <View style={styles.scrollButtonsWrapper}>
          {!atTop && (
            <TouchableOpacity style={styles.scrollButton} onPress={scrollToTop}>
              <Ionicons name="chevron-up" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          {!atBottom && (
            <TouchableOpacity style={styles.scrollButton} onPress={scrollToBottom}>
              <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 24,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 20,
  },
  titleGreen: {
    color: '#6FB84C',
  },
  subtitle: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },

  // ---- แต่ละหัวข้อ ----
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 13.5,
    color: '#666666',
    lineHeight: 21,
  },

  updatedText: {
    fontSize: 12,
    color: '#AAAAAA',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
  },

  // ---- ปุ่มเลื่อนขึ้น/ลง ----
  scrollButtonsWrapper: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    gap: 8,
  },
  scrollButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(26,26,26,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});