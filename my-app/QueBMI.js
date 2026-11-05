import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------- แปลงหน่วย ----------
const cmToFt = (cm) => cm / 30.48;
const ftToCm = (ft) => ft * 30.48;
const kgToLb = (kg) => kg * 2.20462;
const lbToKg = (lb) => lb / 2.20462;

// ---------- ค่าคงที่ของแต่ละแกน ----------
const HEIGHT_ITEM_WIDTH = 22;
const HEIGHT_MIN_CM = 120;
const HEIGHT_MAX_CM = 220;

const WEIGHT_ITEM_WIDTH = 64; // ขยายจาก 52 เพื่อรองรับเลข 3 หลัก (เช่น หน่วยปอนด์) ไม่ให้ตัวเลขตัดบรรทัด
const WEIGHT_MIN_KG = 30;
const WEIGHT_MAX_KG = 200;

// =======================================================
// แถบเลือกหน่วย (pill toggle) เช่น ฟุต/เมตร, กก./ปอนด์
// =======================================================
function UnitToggle({ options, value, onChange }) {
  return (
    <View style={styles.unitToggleRow}>
      {options.map((opt) => {
        const isSelected = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[styles.unitPill, isSelected && styles.unitPillSelected]}
            onPress={() => onChange(opt.key)}
          >
            <Text
              style={[
                styles.unitPillText,
                isSelected && styles.unitPillTextSelected,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// =======================================================
// ไม้บรรทัดเลือกส่วนสูง (มีขีด + ตัวเลขกำกับ)
// =======================================================
function HeightRuler({ heightCm, unit, onChangeCm }) {
  // วัดความกว้างจริงของพื้นที่แถบเลื่อน (ไม่ใช่ทั้งหน้าจอ) เพื่อให้จุดกึ่งกลาง
  // ที่คำนวณ ตรงกับจุดกึ่งกลางที่แสดงผลจริงบนอุปกรณ์ทุกขนาด
  const [trackWidth, setTrackWidth] = useState(SCREEN_WIDTH - 48);
  const handleLayout = (e) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.round(w) !== Math.round(trackWidth)) {
      setTrackWidth(w);
    }
  };

  const isFt = unit === 'ft';
  const data = isFt
    ? Array.from(
        { length: Math.round(cmToFt(HEIGHT_MAX_CM) * 10 - cmToFt(HEIGHT_MIN_CM) * 10) + 1 },
        (_, i) => Math.round(cmToFt(HEIGHT_MIN_CM) * 10 + i) / 10
      )
    : Array.from(
        { length: HEIGHT_MAX_CM - HEIGHT_MIN_CM + 1 },
        (_, i) => HEIGHT_MIN_CM + i
      );

  const currentValue = isFt ? Math.round(cmToFt(heightCm) * 10) / 10 : heightCm;
  const selectedIndex = data.findIndex((v) => Math.abs(v - currentValue) < 0.05);

  const handleMomentumEnd = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / HEIGHT_ITEM_WIDTH);
    const clamped = Math.max(0, Math.min(data.length - 1, index));
    const picked = data[clamped];
    onChangeCm(isFt ? ftToCm(picked) : picked);
  };

  return (
    <View onLayout={handleLayout}>
      <ScrollView
        key={unit}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={HEIGHT_ITEM_WIDTH}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: trackWidth / 2 - HEIGHT_ITEM_WIDTH / 2,
        }}
        contentOffset={{
          x: Math.max(0, selectedIndex) * HEIGHT_ITEM_WIDTH,
          y: 0,
        }}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {data.map((v, idx) => {
          const isMajor = idx % 5 === 0;
          return (
            <View key={idx} style={{ width: HEIGHT_ITEM_WIDTH, alignItems: 'center' }}>
              <View
                style={[
                  styles.tick,
                  { height: isMajor ? 26 : 15 },
                ]}
              />
              {isMajor && (
                <Text numberOfLines={1} style={styles.tickLabel}>
                  {isFt ? v.toFixed(1) : v}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* เส้นชี้ตำแหน่งกึ่งกลาง - ใช้ trackWidth ที่วัดจริง ไม่ใช่ SCREEN_WIDTH */}
      <View
        pointerEvents="none"
        style={[styles.centerIndicator, { left: trackWidth / 2 - 1 }]}
      />

      <Text style={styles.bigValue}>
        {isFt ? currentValue.toFixed(1) : Math.round(heightCm)}
        <Text style={styles.unitSuffix}> {isFt ? 'ft' : 'ซม.'}</Text>
      </Text>
    </View>
  );
}

// =======================================================
// แถบตัวเลขเลือกน้ำหนัก (ตัวเลขไล่เรียง + ลูกศรชี้ตำแหน่งด้านล่าง)
// =======================================================
function WeightScroller({ weightKg, unit, onChangeKg }) {
  // วัดความกว้างจริงของพื้นที่แถบเลื่อน เหมือนกับ HeightRuler
  const [trackWidth, setTrackWidth] = useState(SCREEN_WIDTH - 48);
  const handleLayout = (e) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.round(w) !== Math.round(trackWidth)) {
      setTrackWidth(w);
    }
  };

  const isLb = unit === 'lb';
  const data = isLb
    ? Array.from(
        { length: Math.round(kgToLb(WEIGHT_MAX_KG) - kgToLb(WEIGHT_MIN_KG)) + 1 },
        (_, i) => Math.round(kgToLb(WEIGHT_MIN_KG) + i)
      )
    : Array.from(
        { length: WEIGHT_MAX_KG - WEIGHT_MIN_KG + 1 },
        (_, i) => WEIGHT_MIN_KG + i
      );

  const currentValue = isLb ? Math.round(kgToLb(weightKg)) : Math.round(weightKg);
  const selectedIndex = data.findIndex((v) => v === currentValue);

  const handleMomentumEnd = (e) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / WEIGHT_ITEM_WIDTH);
    const clamped = Math.max(0, Math.min(data.length - 1, index));
    const picked = data[clamped];
    onChangeKg(isLb ? lbToKg(picked) : picked);
  };

  return (
    <View onLayout={handleLayout}>
      <ScrollView
        key={unit}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={WEIGHT_ITEM_WIDTH}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: trackWidth / 2 - WEIGHT_ITEM_WIDTH / 2,
        }}
        contentOffset={{
          x: Math.max(0, selectedIndex) * WEIGHT_ITEM_WIDTH,
          y: 0,
        }}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {data.map((v, idx) => {
          const isSelected = v === currentValue;
          return (
            <View key={idx} style={{ width: WEIGHT_ITEM_WIDTH, alignItems: 'center' }}>
              <Text
                numberOfLines={1}
                ellipsizeMode="clip"
                style={[
                  styles.weightNumber,
                  isSelected && styles.weightNumberSelected,
                ]}
              >
                {v}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View pointerEvents="none" style={styles.triangleWrapper}>
        <Ionicons name="caret-up" size={16} color="#1A1A1A" />
      </View>
    </View>
  );
}

// =======================================================
// หน้าจอหลัก QueBMI
// =======================================================
export default function QueBMI({ navigation, route }) {
  const { uid, email, name, gender, goal, birthDate, age } = route.params;
  const insets = useSafeAreaInsets();

  const [heightUnit, setHeightUnit] = useState('cm'); // 'cm' | 'ft'
  const [weightUnit, setWeightUnit] = useState('kg'); // 'kg' | 'lb'
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(60);

  const handleNext = () => {
    navigation.navigate('QueActivity', {
      uid,
      email,
      name,
      gender,
      goal,
      birthDate,
      age,
      height: Math.round(heightCm),
      weight: Math.round(weightKg),
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
        <Text style={styles.titleGreen}>น้ำหนัก</Text>และ
        <Text style={styles.titleGreen}>ส่วนสูง?</Text>
      </Text>
      <Text style={styles.subtitle}>
        เราจะใช้ข้อมูลนี้เพื่อแนะนำประเภทอาหาร{'\n'}ที่เหมาะสมยิ่งขึ้นให้กับคุณ
      </Text>

      {/* ------ ส่วนสูง ------ */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>ส่วนสูง</Text>
        <UnitToggle
          options={[
            { key: 'ft', label: 'ฟุต' },
            { key: 'cm', label: 'เมตร' },
          ]}
          value={heightUnit}
          onChange={setHeightUnit}
        />
      </View>
      <HeightRuler
        heightCm={heightCm}
        unit={heightUnit}
        onChangeCm={setHeightCm}
      />

      {/* ------ น้ำหนัก ------ */}
      <View style={[styles.sectionHeaderRow, { marginTop: 36 }]}>
        <Text style={styles.sectionLabel}>น้ำหนัก</Text>
        <UnitToggle
          options={[
            { key: 'kg', label: 'กก.' },
            { key: 'lb', label: 'ปอนด์' },
          ]}
          value={weightUnit}
          onChange={setWeightUnit}
        />
      </View>
      <WeightScroller
        weightKg={weightKg}
        unit={weightUnit}
        onChangeKg={setWeightKg}
      />

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
    lineHeight: 58,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 32,
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

  // ---- section header ----
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 36,
    marginHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },

  // ---- unit toggle ----
  unitToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F2',
    borderRadius: 20,
    padding: 3,
  },
  unitPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  unitPillSelected: {
    backgroundColor: '#EFF6E9',
  },
  unitPillText: {
    fontSize: 12,
    color: '#AAAAAA',
    fontWeight: '600',
  },
  unitPillTextSelected: {
    color: '#4C7C3B',
  },

  // ---- height ruler ----
  tick: {
    width: 2,
    borderRadius: 1,
    backgroundColor: '#BFE3AC',
    marginTop: 6,
  },
  tickLabel: {
    fontSize: 9, // ลดจาก 11 ให้พอดีกับเลข 3 หลักในช่องแคบ ไม่ตัดขึ้นบรรทัดใหม่
    color: '#AAAAAA',
    marginTop: 4,
  },
  centerIndicator: {
    position: 'absolute',
    top: 6,
    width: 2,
    height: 26,
    backgroundColor: '#1A1A1A',
    borderRadius: 1,
  },
  bigValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 10,
  },
  unitSuffix: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999999',
  },

  // ---- weight scroller ----
  weightNumber: {
    fontSize: 15,
    color: '#CCCCCC',
    fontWeight: '600',
  },
  weightNumberSelected: {
    fontSize: 24, // ลดจาก 30 ให้พอดีกับตัวเลข 3 หลักไม่ล้นช่อง
    color: '#1A1A1A',
    fontWeight: 'bold',
  },
  triangleWrapper: {
    alignItems: 'center',
    marginTop: 2,
  },

  // ---- next button ----
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