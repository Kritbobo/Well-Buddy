import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  Easing,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from './firebase';
import { getUserProfile } from './surveyService';
import {
  subscribeTodayFoodLogs,
  deleteFoodLog,
  sumNutrition,
  MEAL_LABELS,
  MEAL_ORDER,
} from './foodLogService';
import { getMenuImageMap } from './menuService';
import { addWater, subscribeTodayWater, computeWaterTarget } from './waterLogService';
import { registerForNotificationsAsync, syncAllReminders } from './notificationService';
import {
  getUnreadCount, syncFamilyNotifications, logPersonalNotifications,
} from './notificationCenterService';
import { useLang } from './LanguageContext';
import { MONTHS_LONG, DAYS_LONG } from './appI18n';
import { useGuideTarget, useGuideHome } from './AppGuide';

// วันที่หัวหน้าจอ — ชื่อวัน/เดือนดึงจาก i18n.js ที่เดียว (ห้ามใช้ Intl / toLocaleDateString)
function formatDate(lang, date = new Date()) {
  if (lang === 'en') {
    return `${DAYS_LONG.en[date.getDay()]}, ${date.getDate()} ${MONTHS_LONG.en[date.getMonth()]}`;
  }
  return `วัน${DAYS_LONG.th[date.getDay()]}ที่ ${date.getDate()} ${MONTHS_LONG.th[date.getMonth()]}`;
}

// การ์ดหลักที่โผล่ทีละใบแบบ stagger (เทียบเท่า QUICK_ASKS ของ ChatScreen)
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// replayKey ส่งผ่าน context ให้ทุกชิ้นใน useAssembly — เพิ่มค่าเมื่อดึงรีเฟรช จะเล่นแอนิเมชันเข้าหน้าใหม่
// (โฟกัสหน้าเล่นใหม่อยู่แล้วผ่าน useFocusEffect) ไม่ผูกกับ logs / waterMl / totals / lang / ready
const ReplayContext = React.createContext(0);

// Each piece owns its entrance; live data changes never restart the assembly.
// fade=false สำหรับการ์ดที่มีเงา (elevation) — ใช้ transform อย่างเดียว กันขอบดำบน Android
function useAssembly(delay = 0, x = 0, y = 20, fade = true) {
  const progress = useRef(new Animated.Value(0)).current;
  const replayKey = useContext(ReplayContext);
  useFocusEffect(useCallback(() => {
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1, delay, duration: 520,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, delay, replayKey]));
  const entrance = {
    transform: [
      { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [x, 0] }) },
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) },
    ],
  };
  if (fade) {
    entrance.opacity = progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] });
  }
  return entrance;
}

function AssemblyView({ delay, x, y, fade, style, targetRef, ...props }) {
  const entrance = useAssembly(delay, x, y, fade);
  return <Animated.View {...props} ref={targetRef} collapsable={false} style={[style, entrance]} />;
}

function AssemblyButton({ delay, x, y, fade, style, targetRef, ...props }) {
  const entrance = useAssembly(delay, x, y, fade);
  return <AnimatedTouchable {...props} ref={targetRef} collapsable={false} style={[style, entrance]} />;
}

// ทักทายตามช่วงเวลาของเครื่อง (getHours ล้วนๆ ไม่ใช้ Intl / toLocale*)
function greetingKey(hour) {
  if (hour >= 5 && hour < 12) return 'อรุณสวัสดิ์ {name}';
  if (hour >= 12 && hour < 17) return 'สวัสดีตอนบ่าย {name}';
  if (hour >= 17 && hour < 21) return 'สวัสดีตอนเย็น {name}';
  return 'ราตรีสวัสดิ์ {name}';   // 21:00-04:59
}

// ---- หน้าปัดแคลอรี่ เว้นช่องล่าง 90° ----
const GAUGE_SIZE = 236;
const GAUGE_STROKE = 18;
const GAUGE_SWEEP = 270;
const GAUGE_START = 135;
const TICK_COUNT = 44;
const TICK_GAP = 7;
const TICK_LEN = 6;
const TICK_LEN_MAJOR = 10;
const GAUGE_R = GAUGE_SIZE / 2 - (TICK_LEN_MAJOR + TICK_GAP + GAUGE_STROKE / 2) - 2;

const fmt = (n) => Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function CalorieGauge({ current, target, rangeMin }) {
  const guideRef = useGuideTarget('calories');
  const r = GAUGE_R;
  const C = 2 * Math.PI * r;
  const arcLen = C * (GAUGE_SWEEP / 360);
  const ratio = target > 0 ? current / target : 0;
  const sweep = useRef(new Animated.Value(0)).current;
  const [assembly, setAssembly] = useState(0);
  const replayKey = useContext(ReplayContext); // ดึงรีเฟรชแล้วเส้นเกจวิ่งใหม่พร้อมชิ้นอื่น
  useFocusEffect(useCallback(() => {
    setAssembly(0);
    sweep.setValue(0);
    // SVG geometry uses the JS driver; only this small gauge rerenders.
    const listener = sweep.addListener(({ value }) => setAssembly(value));
    const animation = Animated.timing(sweep, {
      toValue: 1, delay: 180, duration: 1100,
      easing: Easing.inOut(Easing.cubic), useNativeDriver: false,
    });
    animation.start();
    return () => {
      animation.stop();
      sweep.removeListener(listener);
    };
  }, [sweep, replayKey]));
  const pct = Math.max(0, Math.min(ratio, 1)) * assembly;
  const trackLen = arcLen * assembly;
  const over = ratio > 1;

  const cx = GAUGE_SIZE / 2;
  const cy = GAUGE_SIZE / 2;

  // โซนเป้าหมายบนราง (จาก min ถึงเป้า)
  const zoneStart = target > 0 ? Math.min(Math.max(rangeMin / target, 0), 1) : 0;
  const zoneLen = arcLen * Math.max(0, assembly - zoneStart);

  // ขีดสเกลรอบวง
  const ticks = [];
  for (let i = 0; i < TICK_COUNT; i++) {
    const t = i / (TICK_COUNT - 1);
    const a = ((GAUGE_START + GAUGE_SWEEP * t) * Math.PI) / 180;
    const major = i % 6 === 0;
    const inner = r + GAUGE_STROKE / 2 + TICK_GAP;
    const outer = inner + (major ? TICK_LEN_MAJOR : TICK_LEN);
    ticks.push({
      x1: cx + inner * Math.cos(a), y1: cy + inner * Math.sin(a),
      x2: cx + outer * Math.cos(a), y2: cy + outer * Math.sin(a),
      active: t <= pct + 0.001,
      major,
      reveal: Math.min(1, Math.max(0, (assembly - t * 0.88) / 0.12)),
      dx: 7 * Math.cos(a), dy: 7 * Math.sin(a),
    });
  }

  // หัวจับที่ปลายแถบ
  const angle = ((GAUGE_START + GAUGE_SWEEP * pct) * Math.PI) / 180;
  const kx = cx + r * Math.cos(angle);
  const ky = cy + r * Math.sin(angle);

  return (
    <View ref={guideRef} collapsable={false} style={styles.gaugeWrap}>
      <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
        <Defs>
          <SvgGrad id="calArc" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={over ? '#FFD166' : '#FFFFFF'} />
            <Stop offset="1" stopColor={over ? '#FF9F43' : '#FFFFFF'} />
          </SvgGrad>
        </Defs>

        {/* แผ่นกลางจางๆ ให้ตัวเลขมีฐาน */}
        <Circle cx={cx} cy={cy} r={r - GAUGE_STROKE / 2 - 4} fill="rgba(255,255,255,0.12)" opacity={assembly} />

        {/* ราง */}
        <Circle
          cx={cx} cy={cy} r={r}
          stroke="rgba(16,52,8,0.26)" strokeWidth={GAUGE_STROKE}
          strokeDasharray={`${trackLen} ${C - trackLen}`}
          opacity={assembly > 0 ? 1 : 0}
          strokeLinecap="round" fill="none"
          rotation={GAUGE_START} origin={`${cx}, ${cy}`}
        />

        {/* โซนเป้าหมาย — ช่วงที่ควรกินให้ถึง */}
        {zoneLen > 0 && (
          <Circle
            cx={cx} cy={cy} r={r}
            stroke="rgba(255,255,255,0.22)" strokeWidth={GAUGE_STROKE}
            strokeDasharray={`${zoneLen} ${C - zoneLen}`}
            strokeDashoffset={-arcLen * zoneStart}
            strokeLinecap="butt" fill="none"
            rotation={GAUGE_START} origin={`${cx}, ${cy}`}
          />
        )}

        {/* ขีดสเกล */}
        {ticks.map((t, i) => (
          <Line
            key={i}
            x1={t.x1 + t.dx * (1 - t.reveal)} y1={t.y1 + t.dy * (1 - t.reveal)}
            x2={t.x2 + t.dx * (1 - t.reveal)} y2={t.y2 + t.dy * (1 - t.reveal)}
            opacity={t.reveal}
            stroke={t.active ? (over ? '#FFE3AE' : '#FFFFFF') : 'rgba(16,52,8,0.22)'}
            strokeWidth={t.major ? 2.5 : 1.5}
            strokeLinecap="round"
          />
        ))}

        {/* แถบที่กินไปแล้ว */}
        {pct > 0 && (
          <Circle
            cx={cx} cy={cy} r={r}
            stroke="url(#calArc)" strokeWidth={GAUGE_STROKE}
            strokeDasharray={`${arcLen * pct} ${C - arcLen * pct}`}
            strokeLinecap="round" fill="none"
            rotation={GAUGE_START} origin={`${cx}, ${cy}`}
          />
        )}

        {/* หัวจับ */}
        <Circle opacity={Math.min(1, assembly * 8)} cx={kx} cy={ky} r={13} fill="#FFFFFF" />
        <Circle opacity={Math.min(1, assembly * 8)} cx={kx} cy={ky} r={9} fill={over ? '#B45309' : '#1B4D0C'} />
        <Circle opacity={Math.min(1, assembly * 8)} cx={kx} cy={ky} r={3} fill="#FFFFFF" />
      </Svg>

      <AssemblyView delay={400} y={14} style={styles.gaugeCenter} pointerEvents="none">
        <Text style={styles.gaugeValue}>{fmt(current)}</Text>
        <Text style={styles.gaugeUnit}>kcal</Text>
        <View style={[styles.gaugePill, over && styles.gaugePillOver]}>
          <Text style={[styles.gaugePillText, over && styles.gaugePillTextOver]}>
            {Math.round(ratio * 100)}%
          </Text>
        </View>
      </AssemblyView>
    </View>
  );
}

// ข้อความสถานะมุมขวาบน — เปลี่ยนตามความคืบหน้า
function calorieStatus(ratio) {
  if (ratio <= 0) return { text: 'ยังไม่ได้บันทึก', icon: 'ellipse-outline' };
  if (ratio < 0.5) return { text: 'เริ่มต้นได้ดี', icon: 'sunny-outline' };
  if (ratio < 0.9) return { text: 'กำลังไปได้สวย', icon: 'trending-up-outline' };
  if (ratio <= 1) return { text: 'ใกล้ถึงเป้า', icon: 'checkmark-circle-outline' };
  return { text: 'เกินเป้าแล้ว', icon: 'alert-circle-outline' };
}

// ---- ช่องมาโคร 1 ช่อง (คาร์บ/โปรตีน/ไขมัน) ----
function MacroItem({ macro: m, index, isLast, t }) {
  return (
    <AssemblyView delay={460 + index * 90} y={22} style={[styles.macroItem, !isLast && styles.macroDivider]}>
      <Text style={styles.macroValue}>
        {m.current}
        <Text style={styles.macroTarget}>/{m.target}</Text>
      </Text>
      <Text style={styles.macroLabel}>{t(m.label)}</Text>
      <View style={styles.macroTrack}>
        <View
          style={[
            styles.macroFill,
            { width: `${Math.min((m.current / m.target) * 100, 100)}%` },
          ]}
        />
      </View>
    </AssemblyView>
  );
}

// ---- มื้ออาหาร 1 มื้อ (ค่อยๆ โผล่) — แพทเทิร์นเดียวกับ Bubble ของ ChatScreen ----
function MealSection({ meal, index, onPickItem, onDeleteItem, t }) {
  const style = useAssembly(780 + index * 100, 18, 16);

  return (
    <Animated.View style={style}>
      <View style={styles.mealSection}>
        <View style={styles.mealHeader}>
          <View style={styles.mealDot} />
          <View>
            <Text style={styles.mealLabel}>{t(meal.label)}</Text>
            <Text style={styles.mealCalories}>{t('{n} แคลอรี่', { n: `${meal.calories}.0` })}</Text>
          </View>
        </View>

        {meal.items.length === 0 ? (
          <View style={styles.emptyMealBox}>
            <Ionicons name="information-circle-outline" size={16} color="#999999" />
            <Text style={styles.emptyMealText}>{t('ไม่ได้เพิ่มอาหารเข้า')}</Text>
          </View>
        ) : (
          meal.items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.foodItem}
              activeOpacity={0.7}
              onPress={() => onPickItem(item)}
            >
              <View style={styles.foodDot} />
              {item.imageUri ? (
                <Image source={{ uri: item.imageUri }} style={styles.foodImage} />
              ) : (
                <View style={styles.foodImagePlaceholder}>
                  <Ionicons name="fast-food-outline" size={22} color="#BBBBBB" />
                </View>
              )}
              <View style={styles.foodInfo}>
                <Text style={styles.foodName}>{item.name}</Text>
                <Text style={styles.foodCal}>{item.cal} Cal per serving</Text>
                <View style={styles.foodTimeRow}>
                  <Ionicons name="time-outline" size={12} color="#999999" />
                  <Text style={styles.foodTime}>Added at {item.time}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.foodDeleteBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onDeleteItem(item);
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#E06A4C" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </View>
    </Animated.View>
  );
}

export default function HomeDashBoard({ navigation }) {
  const guideScroll = useRef(null);
  const guideScrollY = useRef(0);
  useGuideHome(guideScroll, guideScrollY);
  const macroGuideRef = useGuideTarget('macros');
  const waterGuideRef = useGuideTarget('water');
  const familyGuideRef = useGuideTarget('family');
  const insets = useSafeAreaInsets();
  const { lang, t, ready } = useLang();
  const [picked, setPicked] = useState(null);

  // ---- โปรไฟล์จริงของผู้ใช้ ----
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (uid) getUserProfile(uid).then(setProfile);
  }, []);

  // ---- มื้ออาหารวันนี้ (เรียลไทม์จาก Firestore) ----
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsubscribe = subscribeTodayFoodLogs(uid, setLogs);
    return unsubscribe;
  }, []);

  // ---- แผนผังภาพหน้าปกเมนูสำหรับเติมให้ log ที่ไม่มีรูป ----
  const [menuImageMap, setMenuImageMap] = useState({});
  useEffect(() => {
    getMenuImageMap().then(setMenuImageMap);
  }, []);

  // ---- น้ำดื่มวันนี้ (เรียลไทม์จาก Firestore) ----
  const [waterMl, setWaterMl] = useState(0);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsubscribe = subscribeTodayWater(uid, setWaterMl);
    return unsubscribe;
  }, []);

  const handleAddWater = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await addWater(uid, 250); // แตะละ 1 แก้ว ~250ml
    } catch (e) {
      console.log('addWater error:', e.message);
    }
  };

  const handleDeleteFood = (item) => {
    if (!item?.id) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    Alert.alert(
      t('ลบรายการอาหาร?'),
      t('ต้องการลบ "{name}" ออกจากมื้ออาหารใช่หรือไม่?', { name: item.name }),
      [
        { text: t('ยกเลิก'), style: 'cancel' },
        {
          text: t('ลบรายการ'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFoodLog(uid, item.id);
            } catch (e) {
              Alert.alert(t('เกิดข้อผิดพลาด'), e.message);
            }
          },
        },
      ]
    );
  };

  const userName = profile?.name || t('เพื่อน');
  const dateText = formatDate(lang);
  // คำนวณครั้งเดียวตอน render — ไม่ต้องอัปเดตทุกนาที
  const greeting = t(greetingKey(new Date().getHours()), { name: userName });

  const totals = sumNutrition(logs);
  const calories = {
    current: totals.calories,
    target: profile?.calories || 1850,
  };
  const targetRange = {
    min: profile?.calories ? Math.round(profile.calories * 0.9) : 1700,
    max: profile?.calories || 1850,
  };
  const macros = [
    { label: 'คาร์บ', current: Math.round(totals.carbs), target: profile?.carb || 250 },
    { label: 'โปรตีน', current: Math.round(totals.protein), target: profile?.protein || 100 },
    { label: 'ไขมัน', current: Math.round(totals.fat), target: profile?.fat || 70 },
  ];

  // เป้าน้ำคำนวณจากน้ำหนัก + ระดับกิจกรรมในโปรไฟล์ (ดู waterLogService.computeWaterTarget)
  const water = {
    current: waterMl,
    target: computeWaterTarget(profile),
  };

  // ---- ระบบแจ้งเตือนดื่มน้ำ ----
  // ขอสิทธิ์แจ้งเตือนครั้งแรกที่จอนี้ถูกเปิด (ถ้าเคยขอแล้วจะไม่เด้งซ้ำ)
  useEffect(() => {
    registerForNotificationsAsync();
  }, []);

  // ---- ตั้งคิวแจ้งเตือน + อัปเดตกล่องแจ้งเตือน (รวมเป็นที่เดียว) ----
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // รอให้อ่านภาษาจาก AsyncStorage เสร็จก่อน ไม่งั้นข้อความจะถูกเขียนเป็นภาษา default
    // แล้ว dedupeKey จะกันไม่ให้เขียนซ้ำ ทำให้ติดภาษาผิดทั้งวัน
    if (!ready) return;

    const uid = auth.currentUser?.uid;
    if (!uid || !water.target) return;

    const loggedMeals = {
      breakfast: logs.some((l) => l.mealType === 'breakfast'),
      lunch: logs.some((l) => l.mealType === 'lunch'),
      dinner: logs.some((l) => l.mealType === 'dinner'),
    };
    const payload = { water, calories, loggedMeals };

    (async () => {
      try {
        await syncAllReminders(payload);          // คิวแจ้งเตือนในเครื่อง
        await logPersonalNotifications(uid, payload);
        setUnread(await getUnreadCount(uid));
      } catch (e) {
        console.log('notification sync error:', e);
      }
    })();
  }, [ready, logs, water.current, water.target, calories.current, calories.target]);

  // ---- สแกนครอบครัว + เลขแดงบนกระดิ่ง: ทำตอนเข้าหน้านี้เท่านั้น ----
  // แยกจาก useFocusEffect ของแอนิเมชัน และไม่ผูกกับ state ที่ onSnapshot อัปเดต
  // syncFamilyNotifications อ่าน Firestore ของสมาชิกทุกคน ถ้าผูกกับ logs จะยิงรัวจนเปลืองโควตา
  useFocusEffect(
    useCallback(() => {
      // รอภาษาให้พร้อมก่อน ไม่งั้นข้อความครอบครัวจะถูกเขียนเป็นภาษา default ค้างไว้
      if (!ready) return;

      const uid = auth.currentUser?.uid;
      if (!uid) return;
      (async () => {
        // sync พังก็ไม่ให้ badge พังตาม — นับ unread ต่อได้เสมอ
        try {
          await syncFamilyNotifications(uid);
        } catch (e) {
          console.log('family notification sync error:', e);
        }
        try {
          setUnread(await getUnreadCount(uid));
        } catch (e) {
          console.log('unread count error:', e);
        }
      })();
    }, [ready])
  );

  // ---- ดึงลงเพื่อรีเฟรช ----
  // ข้อมูลหลัก (มื้ออาหาร/น้ำ) มาจาก onSnapshot เรียลไทม์อยู่แล้ว ไม่ต้องโหลดซ้ำ
  // ทำแค่ เล่นแอนิเมชันเข้าหน้าใหม่ + นับ unread ใหม่ — ห้ามเรียก syncFamilyNotifications /
  // logPersonalNotifications ตรงนี้ (อ่าน Firestore ของสมาชิกทุกคน ดึงรัวๆ จะเปลืองโควตา)
  const [replayKey, setReplayKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setReplayKey((k) => k + 1);
    const stop = () => setRefreshing(false);
    const cap = setTimeout(stop, 1000);          // หยุดหมุนภายใน 1 วินาทีเสมอ แม้เน็ตช้า
    const minSpin = new Promise((r) => setTimeout(r, 350)); // ไม่ให้กระพริบหายเร็วเกิน
    try {
      const uid = auth.currentUser?.uid;
      const [count] = await Promise.all([uid ? getUnreadCount(uid) : Promise.resolve(null), minSpin]);
      if (count !== null) setUnread(count);
    } catch (e) {
      console.log('unread count error:', e);
    } finally {
      clearTimeout(cap);
      stop();
    }
  }, []);

  // ---- แอนิเมชันน้ำขึ้น (เพิ่มใหม่ ไม่กระทบโค้ดส่วนอื่น) ----
  // fillAnim = สัดส่วน 0..1 แล้วแปลงเป็น '0%'..'100%' — การ์ดน้ำไม่มีความสูงตายตัวแล้ว (ยืดเท่าการ์ดครอบครัว)
  const fillAnim = useRef(new Animated.Value(0)).current;
  const waveBob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pct = water.target > 0 ? Math.min(water.current / water.target, 1) : 0;
    Animated.timing(fillAnim, {
      toValue: pct,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [water.current, water.target]);

  const fillHeight = fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(waveBob, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(waveBob, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const waveTranslateX = waveBob.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] });

  const meals = MEAL_ORDER.map((key) => {
    const items = logs
      .filter((l) => l.mealType === key)
      .map((l) => {
        const cleanName = (l.name || '').replace(/\n/g, ' ').trim().toLowerCase();
        return {
          id: l.id,
          name: l.name,
          imageUri: l.imageUri || menuImageMap[cleanName] || null,
          cal: l.calories,
          protein: l.protein,
          carbs: l.carbs,
          fat: l.fat,
          mealType: l.mealType,
          // จัดรูปแบบ HH:MM เอง — Hermes บางเครื่องไม่มี Intl ใช้ toLocaleTimeString ไม่ได้
          time: l.createdAt?.toDate
            ? (() => {
                const d = l.createdAt.toDate();
                return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
              })()
            : '',
        };
      });
    return {
      key,
      label: MEAL_LABELS[key],
      calories: items.reduce((sum, it) => sum + it.cal, 0),
      items,
    };
  });

  // ---- สภาวะว่าง ----
  const hasAnyMeal = meals.some((m) => m.items.length > 0);      // มีมื้อไหนบันทึกแม้มื้อเดียว → ซ่อนกล่องเชิญชวน

  return (
    <ReplayContext.Provider value={replayKey}>
    <ScrollView
      ref={guideScroll}
      onScroll={event => { guideScrollY.current = event.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={16}
     style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 24,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={GREEN}
          colors={[GREEN]}
          progressViewOffset={insets.top}
        />
      }
    >
      {/* Header */}
      <View>
        <View style={styles.header}>
          <View>
            <AssemblyView delay={0} x={-18} y={0}><Text style={styles.greeting}>{greeting}</Text></AssemblyView>
            <AssemblyView delay={70} x={-12} y={0}><Text style={styles.dateText}>{dateText}</Text></AssemblyView>
          </View>
          <AssemblyView delay={120} x={20} y={0} style={{ flexDirection: 'row', gap: 10 }}>
            {/* ปุ่มวิเคราะห์ข้อมูลเชิงลึก (Insight) */}
            <TouchableOpacity
             style={styles.notifButton}
              onPress={() => navigation.navigate('Insights')}
            >
              <Ionicons name="analytics-outline" size={20} color="#1A1A1A" />
            </TouchableOpacity>

            {/* ปุ่มแจ้งเตือน */}
            <TouchableOpacity
             style={styles.notifButton}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color="#1A1A1A" />
              {unread > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          </AssemblyView>
        </View>
      </View>

      {/* การ์ดแคลอรี่ */}
      <View>
        <LinearGradient
          colors={['#9BE075', '#63B845']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
         style={styles.calorieCard}
        >
          {/* ก้อนแสงตกแต่ง ให้การ์ดมีมิติ */}
          <View style={styles.calorieBlobA} pointerEvents="none" />
          <View style={styles.calorieBlobB} pointerEvents="none" />

          <View style={styles.calorieHeadRow}>
            <AssemblyView delay={100} x={-22} y={0} style={styles.calorieBadge}>
              <Ionicons name="flash" size={14} color="#F2C94C" />
              <Text style={styles.calorieBadgeText}>{t('แคลอรี่วันนี้')}</Text>
            </AssemblyView>

            {(() => {
              const st = calorieStatus(
                calories.target > 0 ? calories.current / calories.target : 0
              );
              return (
                <AssemblyView delay={200} x={22} y={0} style={styles.calorieStatusChip}>
                  <Ionicons name={st.icon} size={12} color="#1B4D0C" />
                  <Text style={styles.calorieStatusText}>{t(st.text)}</Text>
                </AssemblyView>
              );
            })()}
          </View>

          <CalorieGauge
            current={calories.current}
            target={calories.target}
            rangeMin={targetRange.min}
          />

          <AssemblyView delay={500} y={12} style={styles.gaugeLegend}>
            <View style={styles.gaugeLegendSwatch} />
            <Text style={styles.gaugeLegendText}>
              {t('โซนเป้าหมาย {min} – {max} kcal', { min: fmt(targetRange.min), max: fmt(targetRange.max) })}
            </Text>
          </AssemblyView>

          <View style={styles.gaugeFootRow}>
            <AssemblyView delay={540} x={-20} y={0} style={styles.gaugeFootChip}>
              <View style={styles.gaugeFootIcon}>
                <Ionicons name="flag" size={13} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.gaugeFootLabel}>{t('เป้าหมาย')}</Text>
                <Text style={styles.gaugeFootValue}>{fmt(calories.target)}</Text>
              </View>
            </AssemblyView>

            <AssemblyView delay={620} x={20} y={0} style={styles.gaugeFootChip}>
              <View
                style={[
                  styles.gaugeFootIcon,
                  calories.current > calories.target && { backgroundColor: '#B45309' },
                ]}
              >
                <Ionicons
                  name={calories.current > calories.target ? 'alert' : 'flame'}
                  size={13}
                  color="#FFFFFF"
                />
              </View>
              <View>
                <Text style={styles.gaugeFootLabel}>
                  {calories.current > calories.target ? t('เกินเป้า') : t('เหลืออีก')}
                </Text>
                <Text style={styles.gaugeFootValue}>
                  {fmt(Math.abs(calories.target - calories.current))}
                </Text>
              </View>
            </AssemblyView>
          </View>
        </LinearGradient>
      </View>

      {/* การ์ดสารอาหาร (มืด) */}
      <View>
        <View ref={macroGuideRef} collapsable={false} style={styles.macroCard}>
          {macros.map((m, index) => (
            <MacroItem
              key={m.label}
              macro={m}
              index={index}
              isLast={index === macros.length - 1}
              t={t}
            />
          ))}
        </View>
      </View>

      {/* น้ำดื่ม + เพิ่มครอบครัว */}
      <View>
        <View style={styles.row}>
          <AssemblyView targetRef={waterGuideRef} delay={600} x={-26} y={12} style={styles.waterCircle}>
            <Animated.View style={[styles.waterFill, { height: fillHeight }]}>
              <Animated.View
                style={[styles.waterWave, { transform: [{ translateX: waveTranslateX }] }]}
              />
            </Animated.View>
            <View style={styles.waterContent}>
              <Text style={styles.waterValue}>{water.current}</Text>
              <Text style={styles.waterUnit}>ml</Text>
              <Text style={styles.waterRemain}>
                {water.current >= water.target
                  ? t('ครบเป้าหมายแล้ว')
                  : t('เหลืออีก {n} ml', { n: water.target - water.current })}
              </Text>
              <TouchableOpacity style={styles.addWaterButton} onPress={handleAddWater}>
                <Ionicons name="add" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </AssemblyView>

          {/* การ์ดครอบครัว — ชั้นนอก (familyCard) โค้งมุม + overflow hidden ครอบ LinearGradient
              เพราะ Android บางเครื่อง gradient ไม่โค้งตาม; การ์ดนี้ไม่มีเงาจึงไม่ต้องแยกชั้นเงา
              ใช้โทนเหลืองเดิมของการ์ดครอบครัว */}
          <AssemblyButton targetRef={familyGuideRef} delay={700} x={26} y={12} style={styles.familyCard} onPress={() => navigation.navigate('Family')}>
            <LinearGradient
              colors={['#F2E9A8', '#F2E9A8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.familyGradient}
            >
              {/* วงกลมโปร่งตกแต่ง ให้การ์ดมีมิติ */}
              <View style={styles.familyBlobA} pointerEvents="none" />
              <View style={styles.familyBlobB} pointerEvents="none" />

              <Text style={styles.familyTitle}>{t('เพิ่มครอบครัว')}</Text>
              <Text style={styles.familySubtitle}>
                {t('เพิ่มครอบครัวของคุณ')}{'\n'}{t('เพื่อดูของลูกที่คุณรัก')}
              </Text>
              <View style={styles.familyAvatars}>
                <View style={styles.avatarCircle}>
                  <Ionicons name="person" size={16} color="#FFFFFF" />
                </View>
                <View style={[styles.avatarCircle, styles.avatarAdd]}>
                  <Ionicons name="add" size={14} color="#FFFFFF" />
                </View>
                <View style={styles.familyHouse} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
                  <Ionicons name="home" size={30} color="#A87927" />
                </View>
              </View>
            </LinearGradient>
          </AssemblyButton>
        </View>
      </View>

      {/* เมนูอาหารวันนี้ */}
      <AssemblyView delay={720} y={16}><Text style={styles.sectionTitle}>
        {t('มื้ออาหารวันนี้ ({count})', { count: meals.reduce((sum, m) => sum + m.items.length, 0) })}
      </Text>

      </AssemblyView>

      {/* ไม่มีมื้อไหนบันทึกเลยทั้งวัน → กล่องเชิญชวนเหนือรายการมื้ออาหาร */}
      {/* การ์ดขาวมีเงา → fade={false} ใช้ transform อย่างเดียว กันขอบดำบน Android */}
      {!hasAnyMeal && (
        <AssemblyView delay={750} y={16} fade={false} style={styles.emptyDayCard}>
          <View style={styles.emptyDayIcon}>
            <Ionicons name="scan-outline" size={26} color={GREEN} />
          </View>
          <Text style={styles.emptyDayTitle}>{t('ยังไม่ได้บันทึกอะไรวันนี้')}</Text>
          <Text style={styles.emptyDayDesc}>{t('เริ่มจากสแกนมื้อแรกเลย')}</Text>
          <TouchableOpacity
            style={styles.emptyDayBtn}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Scan')} // ชื่อ route จาก Tab.Screen ใน MainTab.js
          >
            <Ionicons name="scan" size={16} color="#FFFFFF" />
            <Text style={styles.emptyDayBtnText}>{t('สแกนเลย')}</Text>
          </TouchableOpacity>
        </AssemblyView>
      )}

      {meals.map((meal, index) => (
        <MealSection
          key={meal.key}
          meal={meal}
          index={index}
          onPickItem={setPicked}
          onDeleteItem={handleDeleteFood}
          t={t}
        />
      ))}

      <Modal visible={!!picked} transparent animationType="fade" onRequestClose={() => setPicked(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            {picked?.imageUri ? (
              <Image source={{ uri: picked.imageUri }} style={styles.modalImg} />
            ) : (
              <View style={[styles.modalImg, styles.modalImgEmpty]}>
                <Ionicons name="fast-food-outline" size={56} color="#D8D8D8" />
              </View>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setPicked(null)}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.modalBody}>
              <Text style={styles.modalName}>{picked?.name}</Text>
              <Text style={styles.modalMeal}>{t(MEAL_LABELS[picked?.mealType] || '')}</Text>
              <LinearGradient colors={['#7FC97F', '#6FB84C']} style={styles.modalCal}>
                <Text style={styles.modalCalValue}>{Math.round(picked?.cal || 0)}</Text>
                <Text style={styles.modalCalUnit}>kcal</Text>
              </LinearGradient>
              <View style={styles.modalMacroRow}>
                <View style={[styles.modalMacro, { backgroundColor: '#FBF0DA' }]}>
                  <Text style={[styles.modalMacroVal, { color: '#C98A1F' }]}>{Math.round(picked?.carbs || 0)}g</Text>
                  <Text style={styles.modalMacroLabel}>คาร์บ</Text>
                </View>
                <View style={[styles.modalMacro, { backgroundColor: '#EEE3F9' }]}>
                  <Text style={[styles.modalMacroVal, { color: '#7C4DBE' }]}>{Math.round(picked?.protein || 0)}g</Text>
                  <Text style={styles.modalMacroLabel}>โปรตีน</Text>
                </View>
                <View style={[styles.modalMacro, { backgroundColor: '#FBE4D8' }]}>
                  <Text style={[styles.modalMacroVal, { color: '#D9702E' }]}>{Math.round(picked?.fat || 0)}g</Text>
                  <Text style={styles.modalMacroLabel}>ไขมัน</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalDeleteBtn}
                activeOpacity={0.8}
                onPress={() => {
                  const target = picked;
                  setPicked(null);
                  handleDeleteFood(target);
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#E06A4C" />
                <Text style={styles.modalDeleteBtnText}>{t('ลบรายการนี้')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </ReplayContext.Provider>
  );
}

const GREEN = '#6FB84C';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  dateText: {
    fontSize: 13,
    color: '#999999',
    marginTop: 4,
  },
  notifButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifBadge: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  calorieCard: {
    borderRadius: 28,
    padding: 18,
    paddingBottom: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  calorieBlobA: {
    position: 'absolute',
    top: -70, right: -50,
    width: 190, height: 190, borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  calorieBlobB: {
    position: 'absolute',
    bottom: -80, left: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(20,70,10,0.10)',
  },
  calorieHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calorieStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  calorieStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1B4D0C',
  },
  calorieBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  calorieBadgeText: {
    fontSize: 12,
    color: '#3D3D3D',
    marginLeft: 5,
    fontWeight: '600',
  },
  calorieValue: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  calorieUnit: {
    fontSize: 18,
    fontWeight: '600',
  },
  calorieTarget: {
    fontSize: 13,
    color: '#3D3D3D',
    marginTop: 4,
    marginBottom: 14,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.6)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2E7D32',
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressLabelText: {
    fontSize: 11,
    color: '#3D3D3D',
  },
  targetRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  targetDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 6,
  },
  targetRangeText: {
    fontSize: 12,
    color: '#3D3D3D',
  },
  targetLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginHorizontal: 8,
  },
  targetRangeValue: {
    fontSize: 12,
    color: '#3D3D3D',
    fontWeight: '600',
  },
  gaugeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 2,
  },
  gaugeCenter: {
    // RN รุ่นใหม่ลบ absoluteFillObject ทิ้งแล้ว — ใช้ absoluteFill ไม่งั้นเลขหลุดลงไปใต้วง
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeValue: {
    fontSize: 50,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1.5,
    lineHeight: 56,
    textShadowColor: 'rgba(20,60,10,0.18)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  gaugeUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1,
    marginTop: -2,
  },
  gaugePill: {
    marginTop: 10,
    minWidth: 54,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 11,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  gaugePillOver: { backgroundColor: '#FFE3AE' },
  gaugePillText: { fontSize: 12, fontWeight: '800', color: '#2F6B18' },
  gaugePillTextOver: { color: '#7C3A06' },

  gaugeLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 12,
  },
  gaugeLegendSwatch: {
    width: 14, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  gaugeLegendText: {
    fontSize: 11,
    color: '#1B4D0C',
    fontWeight: '600',
  },

  gaugeFootRow: { flexDirection: 'row', gap: 10 },
  gaugeFootChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 18,
    paddingVertical: 11,
  },
  gaugeFootIcon: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#2F6B18',
    alignItems: 'center', justifyContent: 'center',
  },
  gaugeFootLabel: { fontSize: 10, color: '#2A5A16', fontWeight: '600' },
  gaugeFootValue: { fontSize: 17, fontWeight: '800', color: '#0F2F07', marginTop: 1 },
  macroCard: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 20,
    paddingVertical: 18,
    marginBottom: 16,
  },
  macroItem: {
    flex: 1,
    paddingHorizontal: 14,
  },
  macroDivider: {
    borderRightWidth: 1,
    borderRightColor: '#3A3A3A',
  },
  macroValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  macroTarget: {
    fontSize: 12,
    fontWeight: '400',
    color: '#999999',
  },
  macroLabel: {
    fontSize: 12,
    color: '#CCCCCC',
    marginTop: 2,
    marginBottom: 8,
  },
  macroTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3A3A3A',
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  // สภาวะว่างในการ์ดมาโคร (สีเดิมของการ์ด: ขาว / #CCCCCC / #999999)
  macroEmpty: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
  },
  macroEmptyTitle: { fontSize: 14, fontWeight: 'bold', color: '#FFFFFF' },
  macroEmptyDesc: { fontSize: 12, color: '#CCCCCC', marginTop: 3, lineHeight: 17 },

  // สภาวะว่างทั้งวัน — การ์ดขาว มุมโค้ง เงาบาง (เงาระดับเดียวกับการ์ดหน้าอื่นในแอป)
  emptyDayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 18,
    marginBottom: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  emptyDayIcon: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: '#EAF6E0',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  emptyDayTitle: { fontSize: 15, fontWeight: 'bold', color: '#1A1A1A', textAlign: 'center' },
  emptyDayDesc: { fontSize: 12, color: '#999999', marginTop: 4, textAlign: 'center' },
  emptyDayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 18,
    marginTop: 14,
  },
  emptyDayBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  // การ์ดน้ำ + ครอบครัว สูงเท่ากันเสมอ: แถวเป็น row + stretch ให้ลูกยืดตามใบที่สูงกว่า
  // ไม่กำหนดความสูงตายตัว (ข้อความ EN ยาวกว่าไทย) การ์ดน้ำมีแค่ minHeight กันเนื้อหาแน่น
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 20,
  },
  waterCircle: {
    width: 130,
    minHeight: 150,
    borderRadius: 20,
    backgroundColor: '#D6F0EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  waterFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#7FD8CF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  waterWave: {
    position: 'absolute',
    top: -10,
    left: -20,
    right: -20,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 20,
  },
  waterContent: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waterValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E9B94',
  },
  waterUnit: {
    fontSize: 12,
    color: '#2E9B94',
    marginBottom: 4,
  },
  waterRemain: {
    fontSize: 11,
    color: '#5FA8A2',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  addWaterButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#3FBDB4',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  // ชั้นนอก: ขนาด/ตำแหน่งเดิม (flex 1 ในแถวคู่) โค้งมุม + ตัดขอบ gradient และวงกลมตกแต่ง
  familyCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  // ชั้นใน: padding เท่าเดิม (16) ความสูงการ์ดจึงเท่าเดิม
  familyGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  familyBlobA: {
    position: 'absolute',
    top: -120, right: -90,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  familyBlobB: {
    position: 'absolute',
    bottom: -55, right: -30,
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  familyTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#4A4A2E',
  },
  familySubtitle: {
    fontSize: 11,
    color: '#6B6B4A',
    marginTop: 6,
    lineHeight: 16,
  },
  familyAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  familyHouse: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  // วงคน/ปุ่มบวก: ไอคอนขาวบนวงสีฟ้า/เข้ม เข้ากับพื้นเหลือง
  avatarCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#5B8FD6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -8,
    borderWidth: 2,
    borderColor: '#F2E9A8',
  },
  avatarAdd: {
    backgroundColor: '#3D3D3D',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 14,
  },
  mealSection: {
    marginBottom: 18,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  mealDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GREEN,
    marginRight: 10,
  },
  mealLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  mealCalories: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  emptyMealBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginLeft: 20,
  },
  emptyMealText: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 6,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 20,
    marginBottom: 12,
  },
  foodDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GREEN,
    marginRight: 10,
  },
  foodImagePlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  foodImage: { width: 46, height: 46, borderRadius: 12, marginRight: 12 },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  foodCal: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  foodTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  foodTime: {
    fontSize: 11,
    color: '#AAAAAA',
    marginLeft: 4,
  },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 26, overflow: 'hidden' },
  modalImg: { width: '100%', height: 240 },
  modalImgEmpty: { backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 22 },
  modalName: { fontSize: 21, fontWeight: '800', color: '#111827' },
  modalMeal: { fontSize: 13, color: '#6FB84C', fontWeight: '700', marginTop: 3 },
  modalCal: { flexDirection: 'row', alignItems: 'baseline', gap: 6, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 20, marginTop: 16 },
  modalCalValue: { fontSize: 34, fontWeight: '900', color: '#fff' },
  modalCalUnit: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  modalMacroRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalMacro: { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  modalMacroVal: { fontSize: 19, fontWeight: '800' },
  modalMacroLabel: { fontSize: 12, color: '#6b7280', marginTop: 3 },
  foodDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FDF2F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  modalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#FDF2F0',
    borderWidth: 1,
    borderColor: '#F5C6BA',
  },
  modalDeleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E06A4C',
  },
});