import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { auth } from './firebase';
import { useLang } from './LanguageContext';

const GuideContext = createContext(null);
const STEPS = [
  { target: 'calories', title: ['แคลอรี่วันนี้', 'Your daily calories'], body: ['ดูพลังงานที่บันทึกเทียบกับเป้าหมายรายวัน ตัวเลขจะอัปเดตเมื่อคุณบันทึกมื้ออาหาร', 'See your logged calories against your daily target. These numbers update when you save a meal.'] },
  { target: 'macros', title: ['สารอาหารของคุณ', 'Your nutrients'], body: ['ดูคาร์บ โปรตีน และไขมันที่ได้รับวันนี้ แต่ละช่องเริ่มที่ศูนย์ และอัปเดตเมื่อคุณบันทึกมื้ออาหาร', 'Check today’s carbs, protein and fat. Each starts at zero and updates when you log a meal.'] },
  { target: 'tab-Scan', title: ['สแกนและบันทึกอาหาร', 'Scan and log food'], body: ['แตะปุ่มสแกนเพื่อถ่ายรูปหรือเลือกรูปอาหาร ตรวจผลวิเคราะห์ เลือกมื้อ แล้วกดบันทึก ข้อมูลจึงจะปรากฏบนแดชบอร์ด', 'Use Scan to take or choose a food photo. Review the estimate, choose a meal and tap Save to add it to your dashboard.'] },
  { target: 'water', title: ['บันทึกน้ำดื่ม', 'Track your water'], body: ['แตะเครื่องหมายบวกเมื่อดื่มน้ำ แต่ละครั้งเพิ่ม 250 ml และดูปริมาณที่เหลือถึงเป้าหมายได้ที่การ์ดนี้', 'Tap the plus after drinking water. Each tap adds 250 ml. This card shows how much remains to reach your target.'] },
  { target: 'family', title: ['ดูแลครอบครัวด้วยกัน', 'Care for your family'], body: ['เปิดหน้าครอบครัวเพื่อสร้างกลุ่ม หรือเข้าร่วมด้วยรหัสเชิญ แล้วเลือกสมาชิกเพื่อดูข้อมูลของคนในครอบครัว', 'Open Family to create a group or join with an invite code, then select a member to view their information.'] },
  { target: 'tab-Pantry', title: ['เมนูและตู้เย็น', 'Meals and pantry'], body: ['ค้นหาเมนูอาหารและจัดการวัตถุดิบในตู้เย็น พร้อมบันทึกวันหมดอายุได้จากเมนูนี้', 'Find meals and manage ingredients in your fridge, including their expiry dates.'] },
  { target: 'tab-Chat', title: ['คุยกับแชตบอต', 'Chat with your assistant'], body: ['ถามเรื่องอาหารและโภชนาการกับแชตบอต หรือสลับไปคุยกับแอดมินได้จากหน้าแชต หากอยากดูคู่มือซ้ำ ให้เปิดจากหน้าโปรไฟล์', 'Ask the chatbot about food and nutrition, or switch to the admin conversation in Chat. You can replay this guide from Profile anytime.'] },
];

export const useAppGuide = () => useContext(GuideContext);

// Callback refs keep the measured target identical to the actual native control.
export function useGuideTarget(id) {
  const { register } = useAppGuide();
  return useCallback(node => register(id, node), [id, register]);
}

export function useGuideHome(scrollRef, scrollY) {
  const { setHome } = useAppGuide();
  useFocusEffect(useCallback(() => {
    setHome({ scrollRef, scrollY });
    return () => setHome(null);
  }, [setHome, scrollRef, scrollY]));
}

export function AppGuideProvider({ children }) {
  const { lang, ready } = useLang();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [surface, setSurface] = useState(null);
  const width = surface?.width || window.width;
  const height = surface?.height || window.height;
  const fontScale = window.fontScale;
  const root = useRef(null);
  const targets = useRef(new Map());
  const navigation = useRef(null);
  const [home, setHome] = useState(null);
  const [seen, setSeen] = useState(null);
  const [step, setStep] = useState(-1);
  const [rect, setRect] = useState(null);
  const [cardHeight, setCardHeight] = useState(250);
  const [appState, setAppState] = useState(AppState.currentState);
  const storageKey = `wellbuddy.guide.v1.${auth.currentUser?.uid || 'guest'}`;
  const active = step >= 0;
  const en = lang === 'en';
  const register = useCallback((id, node) => {
    if (node) targets.current.set(id, node);
    else targets.current.delete(id);
  }, []);
  const setNavigation = useCallback(nav => { navigation.current = nav; }, []);

  useEffect(() => {
    let live = true;
    setSeen(null);
    AsyncStorage.getItem(storageKey).then(value => {
      if (live) setSeen(value === 'seen');
    }).catch(() => { if (live) setSeen(true); });
    return () => { live = false; };
  }, [storageKey]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  const close = useCallback(() => {
    setStep(-1);
    setRect(null);
    setSeen(true);
    // Dismiss, skip and finish all suppress automatic replay on this account/device.
    AsyncStorage.setItem(storageKey, 'seen').catch(() => {});
  }, [storageKey]);

  const start = useCallback(() => {
    navigation.current?.navigate('Home', { screen: 'HomeMain' });
    setRect(null);
    setStep(0);
  }, []);

  useEffect(() => {
    if (!ready || seen !== false || !home || active || appState !== 'active') return;
    // Let the dashboard entrance finish before measuring its controls.
    const timer = setTimeout(start, 1800);
    return () => clearTimeout(timer);
  }, [ready, seen, home, active, appState, start]);

  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [active, close]);

  useEffect(() => {
    setRect(null);
    if (!active || !home || appState !== 'active') return;
    let cancelled = false;
    let attempts = 0;
    let scrolled = false;
    let timer;
    const id = STEPS[step].target;
    const measure = () => {
      if (cancelled) return;
      attempts += 1;
      const node = targets.current.get(id);
      if (!node || !root.current) {
        if (attempts < 20) timer = setTimeout(measure, 100);
        return;
      }
      root.current.measureInWindow((rootX, rootY) => {
        node.measureInWindow((x, y, w, h) => {
          if (cancelled || w <= 0 || h <= 0) return;
          const localY = y - rootY;
          if (!id.startsWith('tab-') && !scrolled) {
            scrolled = true;
            home.scrollRef.current?.scrollTo({
              y: Math.max(0, home.scrollY.current + localY - insets.top - 28), animated: false,
            });
            timer = setTimeout(measure, 120);
            return;
          }
          const left = Math.max(8, x - rootX - 6);
          const top = Math.max(insets.top + 4, localY - 6);
          const right = Math.min(width - 8, x - rootX + w + 6);
          // Targets may extend into the bottom inset (the floating tab bar does).
          // Only clip the spotlight at the overlay's actual bounds.
          const bottom = Math.min(height - 4, localY + h + 6);
          if (right > left && bottom > top) setRect({ x: left, y: top, width: right - left, height: bottom - top });
        });
      });
    };
    timer = setTimeout(measure, 550);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [active, step, home, width, height, fontScale, insets.top, insets.bottom, appState]);

  const value = useMemo(() => ({ register, setNavigation, setHome, start, active }), [register, setNavigation, start, active]);
  const maxCardHeight = Math.max(120, height - insets.top - insets.bottom - 32);
  const below = rect ? rect.y + rect.height + 14 : insets.top + 24;
  const top = rect && below + cardHeight > height - insets.bottom - 12
    ? Math.max(insets.top + 12, rect.y - cardHeight - 14) : below;
  const radius = rect ? Math.min(18, rect.width / 2, rect.height / 2) : 0;
  const hole = rect ? ` M ${rect.x + radius} ${rect.y}
    H ${rect.x + rect.width - radius} Q ${rect.x + rect.width} ${rect.y} ${rect.x + rect.width} ${rect.y + radius}
    V ${rect.y + rect.height - radius} Q ${rect.x + rect.width} ${rect.y + rect.height} ${rect.x + rect.width - radius} ${rect.y + rect.height}
    H ${rect.x + radius} Q ${rect.x} ${rect.y + rect.height} ${rect.x} ${rect.y + rect.height - radius}
    V ${rect.y + radius} Q ${rect.x} ${rect.y} ${rect.x + radius} ${rect.y} Z` : '';

  return (
    <GuideContext.Provider value={value}>
      <View ref={root} collapsable={false} style={styles.root} onLayout={({ nativeEvent: { layout } }) => {
        setSurface(previous => previous?.width === layout.width && previous?.height === layout.height
          ? previous : { width: layout.width, height: layout.height });
      }}>
        <View style={styles.root} accessibilityElementsHidden={active} importantForAccessibility={active ? 'no-hide-descendants' : 'auto'}>
          {children}
        </View>
        {active && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 24 }]} accessibilityViewIsModal>
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
              <Path d={`M 0 0 H ${width} V ${height} H 0 Z${hole}`} fill="rgba(5,18,12,0.76)" fillRule="evenodd" />
              {rect && <Rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx={radius} fill="none" stroke="#B5EF9D" strokeWidth={2} />}
            </Svg>
            {/* This layer consumes touches so the tour cannot log water or open the camera. */}
            <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true} />
            <View onLayout={e => setCardHeight(e.nativeEvent.layout.height)} style={[styles.card, { top, left: 16, width: width - 32, maxHeight: maxCardHeight }]}>
              <View style={styles.heading}>
                <Text style={styles.counter}>{en ? 'QUICK GUIDE' : 'แนะนำการใช้งาน'} · {step + 1}/{STEPS.length}</Text>
                <TouchableOpacity onPress={close} accessibilityRole="button" accessibilityLabel={en ? 'Close guide' : 'ปิดคู่มือ'} style={styles.close}>
                  <Ionicons name="close" size={23} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <ScrollView bounces={false} style={{ flexShrink: 1 }}>
                <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>{STEPS[step].title[en ? 1 : 0]}</Text>
                <Text style={styles.body}>{STEPS[step].body[en ? 1 : 0]}</Text>
              </ScrollView>
              <View style={styles.actions}>
                <View style={styles.dots}>{STEPS.map((_, i) => <View key={i} style={[styles.dot, i === step && styles.dotActive]} />)}</View>
                <TouchableOpacity disabled={step === 0} accessibilityRole="button" accessibilityState={{ disabled: step === 0 }} onPress={() => { setRect(null); setStep(s => Math.max(0, s - 1)); }} style={[styles.button, step === 0 && { opacity: 0.35 }]}>
                  <Text style={styles.backText}>{en ? 'Back' : 'ย้อนกลับ'}</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" onPress={() => {
                  if (step === STEPS.length - 1) close();
                  else { setRect(null); setStep(s => Math.min(STEPS.length - 1, s + 1)); }
                }} style={[styles.button, styles.next]}>
                  <Text style={styles.nextText}>{step === STEPS.length - 1 ? (en ? 'Done' : 'เริ่มใช้งาน') : (en ? 'Next' : 'ถัดไป')}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity accessibilityRole="button" onPress={close} style={styles.skip}>
                <Text style={styles.skipText}>{en ? 'Skip guide' : 'ข้ามการแนะนำ'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </GuideContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: { position: 'absolute', backgroundColor: '#17352A', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#527363' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { color: '#B5EF9D', fontSize: 11, fontWeight: '700', flex: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8, marginTop: -8 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 6 },
  body: { color: '#D7E5DD', fontSize: 14, lineHeight: 23, marginTop: 10, marginBottom: 16 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4, flexGrow: 1 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#638273' },
  dotActive: { width: 15, backgroundColor: '#B5EF9D' },
  button: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 13 },
  next: { backgroundColor: '#B5EF9D' },
  nextText: { color: '#17352A', fontWeight: '700', fontSize: 14 },
  backText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  skip: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginBottom: -8, marginTop: 2 },
  skipText: { color: '#BDD0C4', fontSize: 12 },
});