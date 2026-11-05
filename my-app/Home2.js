import React, { useRef, useEffect, useMemo } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Animated,
    PanResponder,
    Dimensions,
    Easing,
    useWindowDimensions,
    Alert,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { getUserRole, checkUserStatus, logoutUser } from './authservice';
import { checkSurveyExists } from './surveyService';

const { width } = Dimensions.get('window');
const BUTTON_WIDTH = width - 56;
const CIRCLE_SIZE = 54; // ขยายวงกลมให้ใหญ่ขึ้น (เดิม 46)
const SWIPE_RANGE = BUTTON_WIDTH - CIRCLE_SIZE - 8;

const RIBBON_OVERFLOW = 80;   // ทะลุนอกจอซ้าย-ขวา
const V_OVERFLOW = 90;        // ทะลุนอกจอด้านบน — กันเส้นขาดที่ยอดโค้ง
const H_PAD = 28;
const AnimatedPath = Animated.createAnimatedComponent(Path);

// เส้นริบบิ้น: เก็บเป็นจุดควบคุมสัดส่วน (0-1) จะได้คำนวณทั้ง path และความยาวจากชุดเดียวกัน
const RIBBON_PTS = [
  [[-0.05, 0.14], [0.16, 0.02], [0.44, 0.05], [0.58, 0.20]],
  [[0.58, 0.20], [0.72, 0.32], [0.68, 0.51], [0.52, 0.59]],
  [[0.52, 0.59], [0.36, 0.67], [0.18, 0.61], [0.16, 0.47]],
  [[0.16, 0.47], [0.14, 0.31], [0.32, 0.23], [0.46, 0.29]],
  [[0.46, 0.29], [0.62, 0.35], [0.74, 0.45], [1.05, 0.73]],
];

// ประมาณความยาวเส้นโค้งด้วยการซอยเป็นเส้นตรงสั้นๆ (ต้องรู้ค่านี้ถึงจะทำ dashoffset ได้)
function cubicLen(p0, p1, p2, p3, steps = 60) {
  let len = 0, lx = p0[0], ly = p0[1];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    const x = u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0];
    const y = u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1];
    len += Math.hypot(x - lx, y - ly);
    lx = x; ly = y;
  }
  return len;
}

// สร้าง path + ความยาว จากขนาดจอที่ได้มาจริง
function buildRibbon(w, h) {
  const px = (p) => [p[0] * w, p[1] * h];

  const d = RIBBON_PTS.reduce((acc, seg, i) => {
    const [s, c1, c2, e] = seg.map(px);
    const head = i === 0 ? `M ${s[0]} ${s[1]} ` : '';
    return acc + head + `C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${e[0]} ${e[1]} `;
  }, '');

  const len = Math.ceil(
    RIBBON_PTS.reduce((sum, seg) => {
      const [s, c1, c2, e] = seg.map(px);
      return sum + cubicLen(s, c1, c2, e);
    }, 0)
  );

  return { d, len };
}

// ---- ริบบิ้นเส้นเดียว ค่อยๆ ถูกวาด เขียว → เหลือง ----
function RibbonIntro({ replayKey }) {
  const win = useWindowDimensions();

  // กันค่า 0 / ค่าเพี้ยน — ถ้าจอเล็กผิดปกติให้ใช้ค่ามาตรฐาน iPhone แทน
  const screenW = win.width > 200 ? win.width : 390;
  const screenH = win.height > 400 ? win.height : 844;

  const w = screenW + RIBBON_OVERFLOW * 2;
  const h = Math.round(screenH * 0.46) + V_OVERFLOW;   // กล่องสูงขึ้น

  const { d, len } = useMemo(() => buildRibbon(w, h), [w, h]);

  const draw = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    draw.setValue(1);
    Animated.timing(draw, {
      toValue: 0,
      duration: 2600,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [replayKey, len]);   // ถ้าขนาดจอเปลี่ยน ให้วาดใหม่

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 24 - V_OVERFLOW,                       // ดึงกล่องขึ้นชดเชย ลายอยู่ที่เดิม
        left: -(RIBBON_OVERFLOW + H_PAD) + 30,      // เดิมไม่มี + 30 — เลื่อนขวา 30
        width: w,
        height: h,
      }}
    >
      <Svg width={w} height={h}>
        <Defs>
          <SvgGrad id="ribbonGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={w} y2={h}>
            <Stop offset="0" stopColor="#6FB84C" />
            <Stop offset="0.45" stopColor="#A8D97F" />
            <Stop offset="1" stopColor="#F2E491" />
          </SvgGrad>
        </Defs>

        <AnimatedPath
          d={d}
          stroke="url(#ribbonGrad)"
          strokeWidth={44}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={len}
          strokeDashoffset={draw.interpolate({
            inputRange: [0, 1],
            outputRange: [0, len],
          })}
        />
      </Svg>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
    const pan = useRef(new Animated.Value(0)).current;
    const swiped = useRef(false);
    const [currentUser, setCurrentUser] = React.useState(auth.currentUser);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setCurrentUser(u);
        });
        return unsubscribe;
    }, []);

    // รีเซ็ตสถานะปุ่มเลื่อนทุกครั้งที่กลับมาที่หน้านี้ (เช่น กด "ย้อนกลับ" จากหน้าอื่นมา)
    // ไม่งั้น swiped.current จะค้างเป็น true จากการปัดครั้งก่อน ทำให้ปัดซ้ำแล้วไม่ไปหน้าถัดไป
    useFocusEffect(
        React.useCallback(() => {
            swiped.current = false;
            pan.setValue(0);
        }, [])
    );

    const handleSwipeSuccess = async () => {
        if (swiped.current) return;
        swiped.current = true;

        const user = currentUser || auth.currentUser;
        if (user) {
            try {
                const status = await checkUserStatus(user.uid);
                if (status.suspended) {
                    await logoutUser();
                    swiped.current = false;
                    pan.setValue(0);
                    Alert.alert('บัญชีถูกระงับการใช้งาน', 'บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
                    return;
                }

                if (status.role === 'admin') {
                    navigation.replace('AdminDashboard');
                    return;
                }

                const done = await checkSurveyExists(user.uid);
                if (done) {
                    navigation.replace('HomeDashBoard');
                } else {
                    navigation.replace('QueName', { uid: user.uid, email: user.email });
                }
                return;
            } catch (err) {
                console.log('Error verifying session in Home2:', err);
                navigation.replace('HomeDashBoard');
                return;
            }
        }

        // ยังไม่ได้ล็อกอิน นำทางไปหน้า Login
        navigation.navigate('Login');
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gesture) => {
                let newX = gesture.dx;
                if (newX < 0) newX = 0;
                if (newX > SWIPE_RANGE) newX = SWIPE_RANGE;
                pan.setValue(newX);
            },
            onPanResponderRelease: (_, gesture) => {
                if (gesture.dx > SWIPE_RANGE * 0.7) {
                    Animated.timing(pan, {
                        toValue: SWIPE_RANGE,
                        duration: 150,
                        useNativeDriver: false,
                    }).start(() => {
                        handleSwipeSuccess();
                    });
                } else {
                    Animated.spring(pan, {
                        toValue: 0,
                        useNativeDriver: false,
                    }).start();
                }
            },
        })
    ).current;

    // ---- แอนิเมชัน: เล่นใหม่ทุกครั้งที่เข้าหน้า (แยกจาก useFocusEffect ที่รีเซ็ตปุ่มปัด) ----
    const [replayKey, setReplayKey] = React.useState(0);
    const lineAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

    useFocusEffect(
        React.useCallback(() => {
            setReplayKey((k) => k + 1);
            lineAnims.forEach((a) => a.setValue(0));
            Animated.stagger(
                110,
                lineAnims.map((a) =>
                    Animated.spring(a, {
                        toValue: 1, friction: 7, tension: 60,
                        delay: 1300,      // เดิม 500 — รอเส้นวาดไปก่อนค่อยโผล่
                        useNativeDriver: true,
                    })
                )
            ).start();
        }, [])
    );

    const lineStyle = (i) => ({
        opacity: lineAnims[i],
        transform: [
            { translateY: lineAnims[i].interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
        ],
    });

    return (
        <View style={styles.container}>
            <RibbonIntro replayKey={replayKey} />

            <View style={styles.topSection} />

            <View style={styles.textSection}>
                <Animated.Text style={[styles.titleBlack, lineStyle(0)]}>มาสร้าง</Animated.Text>
                <Animated.Text style={[styles.titleGreen, lineStyle(1)]}>สุขภาพที่ดี</Animated.Text>
                <Animated.Text style={[styles.titleBlack, lineStyle(2)]}>กันเถอะ</Animated.Text>
            </View>

            <Animated.View style={[styles.bottomSection, lineStyle(3)]}>
                <View style={styles.swipeTrack}>
                    <Text style={styles.swipeLabel}>เริ่มกันเลย</Text>
                    <Animated.View
                        {...panResponder.panHandlers}
                        style={[styles.swipeCircle, { transform: [{ translateX: pan }] }]}
                    >
                        <Ionicons name="chevron-forward" size={26} color="#6FB84C" />
                    </Animated.View>
                </View>

                <View style={styles.signupContainer}>
                    <Text style={styles.signupText}>คุณยังไม่มีบัญชีใช่ไหม? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                        <Text style={styles.signupLink}>สมัครเลย</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>

            <View style={styles.bottomSpace} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 28,
    },
    topSection: {
        flex: 1.8,        // เดิม 1.0 — เผื่อที่ให้ลายใหญ่ขึ้น
        marginTop: 30,
    },
    textSection: {
        flex: 3.2,
        justifyContent: 'flex-end',
        paddingHorizontal: 20,
        paddingBottom: 50,       // เดิม 100 — ลงมา 16
    },
    bottomSection: {
        flex: 0.9,
        justifyContent: 'flex-end',
        paddingHorizontal: 10,
        paddingBottom: 10,       // เพิ่มใหม่ — ดันปุ่มขึ้น 30
    },
    bottomSpace: {
        flex: 0.6,               // เดิม 0.4 — เว้นก้นจอมากขึ้น ปุ่มขยับขึ้นตาม
    },
    titleBlack: {
        fontSize: 60,
        fontWeight: 'bold',
        color: '#1A1A1A',
        lineHeight: 78,
    },
    titleGreen: {
        fontSize: 60,
        fontWeight: 'bold',
        color: '#6FB84C',
        lineHeight: 78,
    },
    swipeTrack: {
        width: BUTTON_WIDTH,
        height: CIRCLE_SIZE + 8,
        borderRadius: (CIRCLE_SIZE + 8) / 2,
        backgroundColor: '#6FB84C',
        justifyContent: 'center',
        position: 'relative',
    },
    swipeLabel: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'center',
    },
    swipeCircle: {
        position: 'absolute',
        left: 4,
        top: 4,
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        borderRadius: CIRCLE_SIZE / 2,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    signupContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 16,
    },
    signupText: {
        color: '#888888',
        fontSize: 14,
    },
    signupLink: {
        color: '#6FB84C',
        fontSize: 14,
        fontWeight: 'bold',
    },
});