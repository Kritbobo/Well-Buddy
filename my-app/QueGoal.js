import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GOAL_OPTIONS = [
  { key: 'lose', label: 'ลดน้ำหนัก' },
  { key: 'maintain', label: 'คุมน้ำหนัก' },
  { key: 'gain', label: 'เพิ่มน้ำหนัก' },
];

export default function QueGoal({ navigation, route }) {
  const { uid, email, name, gender } = route.params;
  const [selected, setSelected] = useState(null);
  const insets = useSafeAreaInsets();

  const handleNext = () => {
    if (!selected) {
      Alert.alert('เลือกข้อมูลไม่ครบ', 'กรุณาเลือกเป้าหมายของคุณ');
      return;
    }
    navigation.navigate('QueBirth', { uid, email, name, gender, goal: selected });
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
        <Text style={styles.titleGreen}>เป้าหมาย</Text>ของคุณ?
      </Text>
      <Text style={styles.subtitle}>
        เราจะใช้ข้อมูลนี้เพื่อแนะนำประเภทอาหาร{'\n'}ที่เหมาะสมยิ่งขึ้นให้กับคุณ
      </Text>

      {/* ตัวเลือกเป้าหมาย */}
      <View style={styles.optionsList}>
        {GOAL_OPTIONS.map((option) => {
          const isSelected = selected === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => setSelected(option.key)}
            >
              <Text
                style={[
                  styles.optionLabel,
                  isSelected && styles.optionLabelSelected,
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
    fontSize: 40,
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
    lineHeight: 19,
  },
  optionsList: {
    marginTop: 40,
    gap: 14,
  },
  option: {
    backgroundColor: '#F2F2F2',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionSelected: {
    backgroundColor: '#EFF6E9',
    borderColor: '#6FB84C',
  },
  optionLabel: {
    fontSize: 15,
    color: '#999999',
    fontWeight: '600',
  },
  optionLabelSelected: {
    color: '#3F7D2C',
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