import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// เปลี่ยนมาใช้ไฟล์ไอคอนของคุณเอง (ดาวน์โหลดจาก Flaticon เป็น PNG พื้นหลังโปร่งใส)
// วางไฟล์ไว้ที่ assets/icons/ แล้วแก้ path ตามจริง
const GENDER_OPTIONS = [
  { key: 'male', label: 'ชาย', icon: require('./assets/user-beard.png') },
  { key: 'female', label: 'หญิง', icon: require('./assets/woman-head.png') },
];

// สีเทา = ค่าเริ่มต้น (ยังไม่เลือก)
const COLOR_UNSELECTED = '#AAAAAA';
// สีเขียวเข้ม = เมื่อเลือกแล้ว
const COLOR_SELECTED = '#4C7C3B';

export default function QueGender({ navigation, route }) {
  const { uid, email, name } = route.params;
  const [selected, setSelected] = useState(null);
  const insets = useSafeAreaInsets();

  const handleNext = () => {
    if (!selected) {
      Alert.alert('เลือกข้อมูลไม่ครบ', 'กรุณาเลือกเพศของคุณ');
      return;
    }
    navigation.navigate('QueGoal', { uid, email, name, gender: selected });
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
        <Text style={styles.titleGreen}>เพศ</Text>ของคุณ?
      </Text>
      <Text style={styles.subtitle}>
        เราจะใช้ข้อมูลนี้เพื่อแนะนำประเภทอาหาร{'\n'}ที่เหมาะสมยิ่งขึ้นให้กับคุณ
      </Text>

      {/* ตัวเลือกเพศ */}
      <View style={styles.optionsRow}>
        {GENDER_OPTIONS.map((option) => {
          const isSelected = selected === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => setSelected(option.key)}
            >
              <Image
                source={option.icon}
                style={[
                  styles.icon,
                  { tintColor: isSelected ? COLOR_SELECTED : COLOR_UNSELECTED },
                ]}
                resizeMode="contain"
              />
              <Text
                style={[
                  styles.cardLabel,
                  isSelected && styles.cardLabelSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 44,
  },
  card: {
    width: 130,
    height: 130,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEEEEE',
  },
  cardSelected: {
    backgroundColor: '#EFF6E9',
    borderColor: '#6FB84C',
  },
  icon: {
    width:90,
    height: 90,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 14,
    color: '#AAAAAA',
    fontWeight: '600',
  },
  cardLabelSelected: {
    color: '#1A1A1A',
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