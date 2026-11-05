import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';
import { auth } from './firebase';
import { getUserProfile } from './surveyService';
import { getWeeklyStats, sumNutrition } from './foodLogService';
import { getWeeklyWater, computeWaterTarget } from './waterLogService';
import { getWeeklyInsights } from './geminiService';
import { useLang } from './LanguageContext';

const { width } = Dimensions.get('window');
const BAR_CHART_HEIGHT = 120;

// ---- การ์ดที่ค่อยๆ โผล่ทีละใบ — แพทเทิร์นเดียวกับ Bubble ของ ChatScreen ----
// เล่นใหม่เมื่อ replayKey เปลี่ยน (เข้าหน้าใหม่) เท่านั้น ไม่ผูกกับข้อมูล
function Appear({ index, replayKey, children }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      friction: 7,
      tension: 60,
      delay: index * 40,   // โผล่ทีละอัน
      useNativeDriver: true,
    }).start();
  }, [replayKey]);

  // ไม่แตะ opacity เลย — การ์ดทุกใบมีเงา (elevation) ถ้า fade จะเห็นเป็นขอบดำ
  // ความรู้สึก "ค่อยๆ ชัด" มาจากผ้าคลุมที่ fade ออกอย่างเดียว
  const style = {
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
      { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
    ],
  };

  return <Animated.View style={style}>{children}</Animated.View>;
}

// header เขียว — ไหลลงมาจากบน (ค่าเดียวกับ header ของ ChatScreen)
// หน้านี้ header เพิ่ง mount ตอนโหลดเสร็จ (ก่อนหน้านั้นเป็นตัวหมุนเต็มจอ) เลยเล่นจากใน component
function HeaderIn({ replayKey, children }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1, duration: 450, useNativeDriver: true,
    }).start();
  }, [replayKey]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

// ผ้าคลุมสีพื้น — คลุมไว้ก่อนแล้วค่อย ๆ เปิดออก (opacity 1 → 0)
// ใช้แทนการ fade เนื้อหา เพราะการ์ดมีเงา ถ้า fade เนื้อหาจะดูคล้ำ
function Cover({ replayKey }) {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    anim.setValue(1); // รีเซ็ตกลับทึบก่อนเล่นใหม่ทุกครั้งที่เข้าหน้า
    Animated.timing(anim, {
      toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
  }, [replayKey]);

  return <Animated.View pointerEvents="none" style={[styles.cover, { opacity: anim }]} />;
}

// ---- โดนัทชาร์ตแบบวงแหวนหลายสี ใช้ react-native-svg ----
function DonutChart({ segments, size = 130, strokeWidth = 18 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offsetSoFar = 0;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const segLength = (seg.value / 100) * circumference;
        const dashArray = `${segLength} ${circumference - segLength}`;
        const dashOffset = -offsetSoFar;
        offsetSoFar += segLength;
        return (
          <Circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            fill="none"
            strokeLinecap="butt"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        );
      })}
    </Svg>
  );
}

const INSIGHT_STYLE = {
  calories: { bg: '#FBE4EC', title: '#C2185B' },
  hydration: { bg: '#DCEEFB', title: '#1565C0' },
  consistency: { bg: '#FCF3D0', title: '#8A6D00' },
  best_day: { bg: '#FCE4CE', title: '#B4530A' },
};

export default function InsightsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [profile, setProfile] = useState(null);
  const [weekDays, setWeekDays] = useState([]);
  const [weeklyWater, setWeeklyWater] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [prof, weekly, water] = await Promise.all([
          getUserProfile(uid),
          getWeeklyStats(uid, 7),
          getWeeklyWater(uid, 7),
        ]);
        setProfile(prof);
        setWeekDays(weekly);
        setWeeklyWater(water);

        try {
          const aiInsights = await getWeeklyInsights(prof, weekly);
          setInsights(Array.isArray(aiInsights) ? aiInsights : []);
        } catch (e) {
          console.log('getWeeklyInsights error:', e.message);
          setInsights([]);
        }
      } catch (e) {
        console.log('InsightsScreen load error:', e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ---- แอนิเมชัน: เล่นใหม่ทุกครั้งที่เข้าหน้า (แยกจาก useEffect ที่โหลดข้อมูล) ----
  // hooks ต้องอยู่ก่อน early return ของ loading ด้านล่าง
  const [replayKey, setReplayKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setReplayKey((k) => k + 1); // การ์ดทุกใบรีเซ็ตแล้วเล่นใหม่ตอนเข้าหน้า
    }, [])
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerAll]}>
        <ActivityIndicator color="#6FB84C" size="large" />
        <Text style={styles.loadingText}>{t('กำลังวิเคราะห์ข้อมูลของคุณ...')}</Text>
      </View>
    );
  }

  const totalWeekCalories = weekDays.reduce((sum, d) => sum + d.calories, 0);
  const maxCalories = Math.max(...weekDays.map((d) => d.calories), 1);

  // ---- แผนภูมิวงกลม: แนะนำ vs สิ่งที่ทำจริง ----
  const recommended = {
    carb: profile?.carb || 250,
    protein: profile?.protein || 100,
    fat: profile?.fat || 70,
  };
  const recTotal = recommended.carb + recommended.protein + recommended.fat || 1;
  const recPct = {
    carb: Math.round((recommended.carb / recTotal) * 100),
    protein: Math.round((recommended.protein / recTotal) * 100),
    fat: Math.round((recommended.fat / recTotal) * 100),
  };

  const actualTotals = sumNutrition(weekDays);
  const actualSum = actualTotals.carbs + actualTotals.protein + actualTotals.fat || 1;
  const actualPct = {
    carb: Math.round((actualTotals.carbs / actualSum) * 100),
    protein: Math.round((actualTotals.protein / actualSum) * 100),
    fat: Math.round((actualTotals.fat / actualSum) * 100),
  };

  const COLORS = { carb: '#F4A0BB', protein: '#F6D775', fat: '#8FC7EC' };

  // ---- การ์ด "ดื่มน้ำ" ----
  const waterTarget = computeWaterTarget(profile);
  const daysWithWater = weeklyWater.filter((d) => d.ml > 0);
  let hydrationCard = null;
  if (daysWithWater.length > 0) {
    const avgWaterMl = Math.round(
      weeklyWater.reduce((sum, d) => sum + d.ml, 0) / weeklyWater.length
    );
    const pct = waterTarget > 0 ? Math.round((avgWaterMl / waterTarget) * 100) : 0;
    if (pct >= 90) {
      hydrationCard = {
        type: 'hydration',
        title: t('ดื่มน้ำได้ดี'),
        description: t(
          'ดื่มน้ำเฉลี่ย {avg} ml/วัน ใกล้เคียงเป้าหมาย ({pct}% ของเป้า {target} ml) รักษาระดับนี้ไว้ต่อไปนะ',
          { avg: avgWaterMl, pct, target: waterTarget }
        ),
      };
    } else {
      hydrationCard = {
        type: 'hydration',
        title: t('ดื่มน้ำน้อยไป'),
        description: t(
          'ดื่มน้ำเฉลี่ย {avg} ml/วัน ต่ำกว่าเป้าหมาย {short}% ควรตั้งเวลาเตือนดื่มน้ำทุก 1-2 ชั่วโมง',
          { avg: avgWaterMl, short: 100 - pct }
        ),
      };
    }
  }

  // ---- การ์ด "วันที่ดีที่สุด" ----
  const target = profile?.calories || 0;
  const loggedDays = weekDays.filter((d) => d.hasLogs);
  let bestDayCard = null;
  if (loggedDays.length > 0 && target > 0) {
    const best = loggedDays.reduce((closest, d) =>
      Math.abs(d.calories - target) < Math.abs(closest.calories - target) ? d : closest
    );
    bestDayCard = {
      type: 'best_day',
      title: t('วันที่ดีที่สุด'),
      description: t(
        'วันที่ {day} กินได้ {cal} kcal ใกล้เคียงเป้าหมายที่สุด นี่คือวันตัวอย่างที่ดี',
        { day: best.day, cal: best.calories }
      ),
    };
  }

  const allCards = [...insights, ...(hydrationCard ? [hydrationCard] : []), ...(bestDayCard ? [bestDayCard] : [])];

  // 1️⃣ คำนวณวันที่กินแคลอรี่ไม่เกินเป้าหมาย (สำหรับ Streak)
  const targetCals = profile?.calories || 2000;
  const successDays = weekDays.filter((d) => d.calories > 0 && d.calories <= targetCals).length;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <HeaderIn replayKey={replayKey}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t('ข้อมูลเชิงลึก')}</Text>
              <Text style={styles.subtitle}>{t('ของ{name}', { name: profile?.name || t('คุณ') })}</Text>
            </View>
            <TouchableOpacity style={styles.bellButton}>
              <Ionicons name="notifications-outline" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
        </HeaderIn>

        {/* กราฟแท่งแคลอรี่รายวัน */}
        <Appear index={0} replayKey={replayKey}>
          <Text style={styles.sectionLabel}>{t('แคลอรี่รายวัน')}</Text>
          <View style={styles.barChartRow}>
            <View style={styles.barChartBars}>
              {weekDays.map((d, i) => {
                const isToday = i === weekDays.length - 1;
                const h = Math.max((d.calories / maxCalories) * BAR_CHART_HEIGHT, 6);
                return (
                  <View key={d.dateKey} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          { height: h, backgroundColor: isToday ? '#6FB84C' : '#E4E4E4' },
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabel}>{d.day}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.barChartAxis}>
              <Text style={styles.axisLabel}>{Math.round(maxCalories)}</Text>
              <Text style={styles.axisLabel}>{Math.round(maxCalories * 0.66)}</Text>
              <Text style={styles.axisLabel}>{Math.round(maxCalories * 0.33)}</Text>
              <Text style={styles.axisLabel}>0</Text>
            </View>
          </View>
        </Appear>

        <Appear index={1} replayKey={replayKey}>
          {/* แคลอรี่รวม 7 วัน */}
          <View style={styles.totalRow}>
            <Ionicons name="time-outline" size={16} color="#6FB84C" />
            <Text style={styles.totalText}>
              {t('แคลอรี่รวม 7 วัน')}{'  '}
              <Text style={{ fontWeight: 'bold', color: '#1A1A1A' }}>{totalWeekCalories} kcal</Text>
            </Text>
          </View>

          {/* น้ำดื่มรวม 7 วัน */}
          <View style={styles.totalRow}>
            <Ionicons name="water-outline" size={16} color="#3FBDB4" />
            <Text style={styles.totalText}>
              {t('น้ำดื่มรวม 7 วัน')}{'  '}
              <Text style={{ fontWeight: 'bold', color: '#1A1A1A' }}>
                {weeklyWater.reduce((sum, d) => sum + d.ml, 0)} ml
              </Text>
            </Text>
          </View>
        </Appear>

        {/* โดนัทคู่: แนะนำ vs ทำจริง */}
        <Appear index={2} replayKey={replayKey}>
          <View style={styles.donutRow}>
            <View style={styles.donutCol}>
              <DonutChart
                segments={[
                  { value: recPct.carb, color: COLORS.carb },
                  { value: recPct.protein, color: COLORS.protein },
                  { value: recPct.fat, color: COLORS.fat },
                ]}
              />
              <View style={styles.donutLabelRow}>
                <Text style={styles.donutLabelTitle}>{t('แนะนำให้ทำตาม')}</Text>
                <Ionicons name="information-circle-outline" size={14} color="#AAAAAA" />
              </View>
            </View>

            <View style={styles.legendCol}>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.carb }]} />
                <View>
                  <Text style={styles.legendLabel}>{t('คาร์บ')}</Text>
                  <Text style={styles.legendValue}>{actualTotals.carbs}g</Text>
                </View>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.fat }]} />
                <View>
                  <Text style={styles.legendLabel}>{t('ไขมัน')}</Text>
                  <Text style={styles.legendValue}>{actualTotals.fat}g</Text>
                </View>
              </View>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.protein }]} />
                <View>
                  <Text style={styles.legendLabel}>{t('โปรตีน')}</Text>
                  <Text style={styles.legendValue}>{actualTotals.protein}g</Text>
                </View>
              </View>
            </View>

            <View style={styles.donutCol}>
              <DonutChart
                segments={[
                  { value: actualPct.carb, color: COLORS.carb },
                  { value: actualPct.protein, color: COLORS.protein },
                  { value: actualPct.fat, color: COLORS.fat },
                ]}
              />
              <View style={styles.donutLabelRow}>
                <Text style={styles.donutLabelTitle}>{t('สิ่งที่ทำจริง')}</Text>
                <Ionicons name="alert-circle-outline" size={14} color="#E08A3C" />
              </View>
            </View>
          </View>
        </Appear>

        {/* 2️⃣ บทวิเคราะห์สารอาหาร (ไอเดีย 3) */}
        <Appear index={3} replayKey={replayKey}>
          <View style={{ marginTop: 0, padding: 16, backgroundColor: '#F9F9F9', borderRadius: 18, marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 10 }}>
              {t('บทวิเคราะห์สารอาหารของคุณ:')}
            </Text>
            {actualPct.carb > recPct.carb + 10 && (
              <Text style={{ color: '#E91E63', marginBottom: 5, fontSize: 13 }}>{t('• คุณทานคาร์โบไฮเดรตสูงกว่าเป้าหมาย ลองลดแป้งหรือน้ำตาลลงนิดนึงนะ')}</Text>
            )}
            {actualPct.protein < recPct.protein - 10 && (
              <Text style={{ color: '#010101', marginBottom: 5, fontSize: 13 }}>{t('• โปรตีนยังน้อยไปนิดนึง ลองเพิ่มเนื้อสัตว์, ไข่ หรือถั่วในมื้อถัดไป')}</Text>
            )}
            {actualPct.fat > recPct.fat + 10 && (
              <Text style={{ color: '#F44336', marginBottom: 5, fontSize: 13 }}>{t('• ปริมาณไขมันค่อนข้างสูง เลี่ยงของทอดหรือของมันในมื้อเย็นดูนะ')}</Text>
            )}
            {Math.abs(actualPct.carb - recPct.carb) <= 10 && Math.abs(actualPct.protein - recPct.protein) <= 10 && Math.abs(actualPct.fat - recPct.fat) <= 10 && (
              <Text style={{ color: '#4CAF50', marginBottom: 5, fontSize: 13 }}>{t('• เยี่ยมมาก! คุณรักษาสมดุลสารอาหารได้ดีมาก')}</Text>
            )}
          </View>
        </Appear>

        {allCards.length === 0 ? (
          <Appear index={4} replayKey={replayKey}>
            <View style={styles.emptyBox}>
              <Ionicons name="sparkles-outline" size={18} color="#AAAAAA" />
              <Text style={styles.emptyText}>{t('ยังไม่มีข้อมูลพอให้ AI วิเคราะห์ ลองบันทึกอาหารสัก 2-3 วันก่อนนะครับ')}</Text>
            </View>
          </Appear>
        ) : (
          allCards.map((card, i) => {
            const style = INSIGHT_STYLE[card.type] || INSIGHT_STYLE.consistency;
            return (
              <Appear key={i} index={i + 4} replayKey={replayKey}>
                <View style={[styles.insightCard, { backgroundColor: style.bg }]}>
                  <Text style={[styles.insightTitle, { color: style.title }]}>{card.title}</Text>
                  <Text style={styles.insightDescription}>{card.description}</Text>
                </View>
              </Appear>
            );
          })
        )}

        {/* 4️⃣ เคล็ดลับสุขภาพวันนี้ (ไอเดีย 2) */}
        <Appear index={4 + allCards.length} replayKey={replayKey}>
          <View style={[styles.insightCard, { backgroundColor: '#FFF9E6', borderWidth: 1, borderColor: '#FFE082', marginTop: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="bulb-outline" size={22} color="#F57F17" />
              <Text style={[styles.insightTitle, { color: '#F57F17', marginLeft: 8, marginTop: 4 }]}>{t('เคล็ดลับสุขภาพวันนี้')}</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#5D4037', lineHeight: 20 }}>
              "{t('การดื่มน้ำ 1 แก้วทันทีหลังตื่นนอน ช่วยกระตุ้นระบบเผาผลาญและทำให้สมองตื่นตัวพร้อมรับวันใหม่!')}"
            </Text>
          </View>
        </Appear>

      </ScrollView>

      <Cover replayKey={replayKey} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 20 },
  centerAll: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#999999' },

  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24, gap: 12 },
  backButton: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#F0F0F0',
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' },
  subtitle: { fontSize: 13, color: '#999999', marginTop: 2 },
  bellButton: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#F0F0F0',
    justifyContent: 'center', alignItems: 'center',
  },

  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 },
  barChartRow: { flexDirection: 'row', marginBottom: 20 },
  barChartBars: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  barCol: { alignItems: 'center', width: (width - 40 - 50) / 7 },
  barTrack: { height: BAR_CHART_HEIGHT, justifyContent: 'flex-end' },
  bar: { width: 18, borderRadius: 9 },
  barLabel: { fontSize: 11, color: '#AAAAAA', marginTop: 8 },
  barChartAxis: { justifyContent: 'space-between', height: BAR_CHART_HEIGHT, marginLeft: 8, paddingBottom: 20 },
  axisLabel: { fontSize: 11, color: '#CCCCCC' },

  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  totalText: { fontSize: 13, color: '#666666' },

  donutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  donutCol: { alignItems: 'center' },
  donutLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  donutLabelTitle: { fontSize: 12, color: '#666666', fontWeight: '600' },

  legendCol: { gap: 14 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, color: '#999999' },
  legendValue: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' },

  sectionTitleBig: { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 16 },

  insightCard: { borderRadius: 18, padding: 16, marginBottom: 14 },
  insightTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 6 },
  insightDescription: { fontSize: 13, color: '#5A5A5A', lineHeight: 19 },

  emptyBox: {
    flexDirection: 'row', gap: 8, backgroundColor: '#F5F5F5', borderRadius: 16,
    padding: 16, alignItems: 'center',
  },
  emptyText: { flex: 1, fontSize: 12, color: '#999999', lineHeight: 18 },
});