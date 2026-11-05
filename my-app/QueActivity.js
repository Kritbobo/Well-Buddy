import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { saveSurveyData } from './surveyService';
import { calculateNutritionPlan } from './nutritionCalculator';

// เปลี่ยน path ให้ตรงกับไฟล์ไอคอนของคุณ
const calorieIcon = require('./assets/calorie.png');
const proteinIcon = require('./assets/protein.png');
const carbIcon = require('./assets/carb.png');
const fatIcon = require('./assets/fat.png');

const ACTIVITY_OPTIONS = [
  {
    key: 'low',
    title: '0-2 ครั้ง/สัปดาห์',
    subtitle: 'ไม่ออกกำลังกายเลย / นานๆที',
  },
  {
    key: 'medium',
    title: '3-5 ครั้ง/สัปดาห์',
    subtitle: 'ออกกำลังกายบ้างเป็นครั้งคราว / บ่อยๆ',
  },
  {
    key: 'high',
    title: '6+ ครั้ง/สัปดาห์',
    subtitle: 'ออกกำลังกายเป็นประจำ',
  },
];

export default function QueActivity({ navigation, route }) {
  const { uid, email, name, gender, goal, birthDate, age, height, weight } =
    route.params;
  const insets = useSafeAreaInsets();

  const [activityLevel, setActivityLevel] = useState('medium');
  const [loading, setLoading] = useState(false);

  // คำนวณแคลอรี่และสารอาหารหลักใหม่ทุกครั้งที่เปลี่ยนระดับกิจกรรม
  const nutrition = useMemo(
    () =>
      calculateNutritionPlan({
        gender,
        weightKg: weight,
        heightCm: height,
        age,
        activityLevel,
        goal,
      }),
    [gender, weight, height, age, activityLevel, goal]
  );

  const handleNext = async () => {
    setLoading(true);
    const result = await saveSurveyData(uid, {
      email,
      name,
      gender,
      goal,
      birthDate,
      age,
      height,
      weight,
      activityLevel,
      calories: nutrition.calories,
      protein: nutrition.proteinG,
      carb: nutrition.carbG,
      fat: nutrition.fatG,
      bmi: nutrition.bmi,
      bmiCategory: nutrition.bmiCategory,
      bmiLabel: nutrition.bmiLabel,
    });
    setLoading(false);

    if (result.success) {
      navigation.replace('HomeDashBoard');
    } else {
      Alert.alert('บันทึกไม่สำเร็จ', result.message);
    }
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

      {/* เนื้อหาที่เลื่อนได้ */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* หัวข้อ */}
        <Text style={styles.title}>
          ระดับ<Text style={styles.titleGreen}>กิจกรรม?</Text>
        </Text>
      <Text style={styles.subtitle}>
        เราจะใช้ข้อมูลนี้เพื่อแนะนำประเภทอาหาร{'\n'}ที่เหมาะสมยิ่งขึ้นให้กับคุณ
      </Text>

      {/* ตัวเลือกระดับกิจกรรม */}
      <View style={styles.optionsList}>
        {ACTIVITY_OPTIONS.map((option) => {
          const isSelected = activityLevel === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => setActivityLevel(option.key)}
            >
              <Text
                style={[
                  styles.optionTitle,
                  isSelected && styles.optionTitleSelected,
                ]}
              >
                {option.title}
              </Text>
              <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* คำแนะนำประจำวัน */}
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryTitle}>คำแนะนำประจำวันของคุณ</Text>
        <Text style={styles.summarySubtitle}>
          คุณสามารถแก้ไขข้อมูลเมื่อไหร่ก็ได้
        </Text>
      </View>

      <View style={styles.calorieCard}>
        <Image source={calorieIcon} style={styles.calorieIcon} resizeMode="contain" />
        <View>
          <Text style={styles.calorieValue}>{nutrition.calories}</Text>
          <Text style={styles.calorieLabel}>แคลอรี่</Text>
        </View>
      </View>

      <View style={styles.macroRow}>
        <View style={[styles.macroCard, styles.macroCardProtein]}>
          <Image source={proteinIcon} style={styles.macroIcon} resizeMode="contain" />
          <Text style={[styles.macroValue, styles.macroValueProtein]}>
            {nutrition.proteinG}g
          </Text>
          <Text style={styles.macroLabel}>โปรตีน</Text>
        </View>

        <View style={[styles.macroCard, styles.macroCardCarb]}>
          <Image source={carbIcon} style={styles.macroIcon} resizeMode="contain" />
          <Text style={[styles.macroValue, styles.macroValueCarb]}>
            {nutrition.carbG}g
          </Text>
          <Text style={styles.macroLabel}>คาร์บ</Text>
        </View>

        <View style={[styles.macroCard, styles.macroCardFat]}>
          <Image source={fatIcon} style={styles.macroIcon} resizeMode="contain" />
          <Text style={[styles.macroValue, styles.macroValueFat]}>
            {nutrition.fatG}g
          </Text>
          <Text style={styles.macroLabel}>ไขมัน</Text>
        </View>
      </View>

      </ScrollView>

      {/* ปุ่มถัดไป */}
      <TouchableOpacity
        style={[styles.nextButton, loading && { opacity: 0.7 }]}
        onPress={handleNext}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.nextButtonText}>ถัดไป</Text>
        )}
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
    lineHeight: 58,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 24,
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

  // ---- ตัวเลือกระดับกิจกรรม ----
  optionsList: {
    marginTop: 24,
    gap: 12,
  },
  option: {
    backgroundColor: '#F2F2F2',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionSelected: {
    backgroundColor: '#EAF3DE',
    borderColor: '#6FB84C',
  },
  optionTitle: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '700',
  },
  optionTitleSelected: {
    color: '#3F7D2C',
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#999999',
    marginTop: 4,
  },

  // ---- สรุปคำแนะนำ ----
  summaryHeader: {
    marginTop: 28,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  summarySubtitle: {
    fontSize: 14,
    color: '#999999',
    marginTop: 2,
  },

  calorieCard: {
    marginTop: 14,
    backgroundColor: '#EAF3DE',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calorieIcon: {
    width: 32,
    height: 32,
  },
  calorieValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  calorieLabel: {
    fontSize: 14,
    color: '#6B8E5A',
    marginTop: 2,
  },

  macroRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  macroCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  macroCardProtein: {
    backgroundColor: '#EEE3F9',
  },
  macroCardCarb: {
    backgroundColor: '#FBF0DA',
  },
  macroCardFat: {
    backgroundColor: '#FBE4D8',
  },
  macroIcon: {
    width: 24,
    height: 24,
    marginBottom: 8,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  macroValueProtein: {
    color: '#7C4DBE',
  },
  macroValueCarb: {
    color: '#C98A1F',
  },
  macroValueFat: {
    color: '#D9702E',
  },
  macroLabel: {
    fontSize: 14,
    color: '#8A8A8A',
    marginTop: 2,
  },

  // ---- ปุ่มถัดไป ----
  nextButton: {
    backgroundColor: '#6FB84C',
    borderRadius: 26,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});