import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

// คำนวณอายุ (ปี) จากวันเกิด เทียบกับวันปัจจุบัน
function calculateAge(birthDate) {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }
  return age;
}

function formatThaiDate(date) {
  const day = date.getDate();
  const month = THAI_MONTHS_SHORT[date.getMonth()];
  const year = date.getFullYear(); // ใช้ปี ค.ศ. ตามดีไซน์ต้นแบบ
  return `${day} / ${month} / ${year}`;
}

export default function QueBirth({ navigation, route }) {
  const { uid, email, name, gender, goal } = route.params;
  const [birthDate, setBirthDate] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const insets = useSafeAreaInsets();

  const age = birthDate ? calculateAge(birthDate) : null;

  const handleOpenPicker = () => setShowPicker(true);

  const handleChangeDate = (event, selectedDate) => {
    // บน Android picker จะปิดเองหลังเลือก, บน iOS ต้องปิดเอง
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (event.type === 'dismissed') {
      return;
    }
    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  };

  const handleNext = () => {
    if (!birthDate) {
      Alert.alert('เลือกข้อมูลไม่ครบ', 'กรุณาเลือกวันเกิดของคุณ');
      return;
    }
    navigation.navigate('QueBMI', {
      uid,
      email,
      name,
      gender,
      goal,
      birthDate: birthDate.toISOString(),
      age,
    });
  };

  const handleSkip = () => {
    navigation.replace('HomeDashBoard');
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 },
      ]}
    >
      {/* แถวบน: ย้อนกลับ + ข้าม */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>ข้าม</Text>
        </TouchableOpacity>
      </View>

      {/* หัวข้อ */}
      <Text style={styles.title}>
        <Text style={styles.titleGreen}>วันเกิด</Text>ของคุณ?
      </Text>
      <Text style={styles.subtitle}>
        เราจะใช้ข้อมูลนี้เพื่อแนะนำประเภทอาหาร{'\n'}ที่เหมาะสมยิ่งขึ้นให้กับคุณ
      </Text>

      {/* กล่องแสดงอายุ */}
      <View style={styles.ageBox}>
        <Text style={styles.ageText}>{age !== null ? age : '--'}</Text>
      </View>

      {/* แถวเลือกวันเกิด */}
      <TouchableOpacity style={styles.dateRow} onPress={handleOpenPicker}>
        <Text style={styles.dateText}>
          {birthDate ? formatThaiDate(birthDate) : 'เลือกวันเกิดของคุณ'}
        </Text>
        <Ionicons name="calendar-outline" size={20} color="#6FB84C" />
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={birthDate || new Date(2000, 0, 1)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={handleChangeDate}
        />
      )}

      {Platform.OS === 'ios' && showPicker && (
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => setShowPicker(false)}
        >
          <Text style={styles.doneButtonText}>เสร็จสิ้น</Text>
        </TouchableOpacity>
      )}

      <View style={{ flex: 1 }} />

      {/* ปุ่มถัดไป */}
      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>ถัดไป</Text>
      </TouchableOpacity>
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
    justifyContent: 'space-between',
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
  skipText: {
    color: '#888888',
    fontSize: 14,
  },
  title: {
    fontSize: 42,
    lineHeight: 58,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 40,
  },
  titleGreen: {
    color: '#6FB84C',
  },
  subtitle: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
  },
  ageBox: {
    marginTop: 44,
    backgroundColor: '#EFF6E9',
    borderRadius: 24,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  dateRow: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#EEEEEE',
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  doneButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  doneButtonText: {
    color: '#6FB84C',
    fontSize: 14,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#6FB84C',
    borderRadius: 26,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});