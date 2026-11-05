import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Modal, Animated, Easing, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  getTodayLogs, getTodayTotals, getWeeklyStats,
  getLogsByDate, sumNutrition, MEAL_LABELS, MEAL_ORDER,
} from './foodLogService';
import { auth } from './firebase';
import { sendNudge } from './familyService';
import { getUserProfile } from './surveyService';
import { useLang } from './LanguageContext';

const GOAL_TH = { lose: 'ลดน้ำหนัก', maintain: 'คุมน้ำหนัก', gain: 'เพิ่มน้ำหนัก' };

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

function Bar({ label, eaten, target, color }) {
  const pct = target ? Math.min(eaten / target, 1) : 0;
  const over = target && eaten > target;
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={styles.barTop}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={[styles.barValue, over && { color: '#ef4444' }]}>
          {Math.round(eaten)} / {target || '-'}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: over ? '#ef4444' : color }]} />
      </View>
    </View>
  );
}

export default function MemberDetailScreen({ navigation, route }) {
  const { member, familyId } = route.params;
  const m = member;
  const insets = useSafeAreaInsets();
  const { t } = useLang();

  const [eaten, setEaten] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [logs, setLogs] = useState([]);
  const [week, setWeek] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState(null);
  const [dayModal, setDayModal] = useState(null); // { dateKey, day, logs, totals }
  const [dayLoading, setDayLoading] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  // ---- หน้าต่างส่งข้อความเตือน ----
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [nudgeText, setNudgeText] = useState('');
  const [sending, setSending] = useState(false);
  const [myName, setMyName] = useState('');
  const [myPhoto, setMyPhoto] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([
        getTodayTotals(m.uid),
        getTodayLogs(m.uid),
        getWeeklyStats(m.uid, 7),
      ]).then(([t, l, w]) => {
        if (!active) return;
        setEaten(t);
        setLogs(l);
        setWeek(w);
        setLoading(false);
      });
      return () => { active = false; };
    }, [m.uid])
  );

  // ---- แอนิเมชัน: เล่นใหม่ทุกครั้งที่เข้าหน้า (แยกจาก useFocusEffect ที่โหลดข้อมูล) ----
  useFocusEffect(
    useCallback(() => {
      setReplayKey((k) => k + 1); // การ์ดทุกใบรีเซ็ตแล้วเล่นใหม่ตอนเข้าหน้า
    }, [])
  );

  const target = m.calories || 0;
  const left = Math.max(target - eaten.calories, 0);
  const reached = target && eaten.calories >= target;
  const maxVal = Math.max(target, ...week.map((d) => d.calories), 1);

  // จัดกลุ่มตามมื้อ
  const grouped = MEAL_ORDER.map((key) => ({
    key,
    label: MEAL_LABELS[key],
    items: logs.filter((l) => l.mealType === key),
  })).filter((g) => g.items.length > 0);

  // กดแท่งกราฟ → เปิด bottom sheet สรุปวันนั้น
  const openDay = async (d) => {
    setDayModal({ dateKey: d.dateKey, day: d.day, logs: [], totals: null });
    setDayLoading(true);
    const dayLogs = await getLogsByDate(m.uid, d.dateKey);
    setDayModal({ dateKey: d.dateKey, day: d.day, logs: dayLogs, totals: sumNutrition(dayLogs) });
    setDayLoading(false);
  };

  // ---- สถานะวันนี้ คิดจากข้อมูลที่หน้านี้โหลดมาแล้ว ไม่ยิง Firestore เพิ่ม ----
  const calShort = target > 0 ? Math.max(Math.round(target - eaten.calories), 0) : 0;
  const waterShort = Math.max((m.water?.target || 0) - (m.water?.current || 0), 0);
  const statusLines = [];
  if (calShort > 0) statusLines.push(t('ยังกินไม่ถึงเป้า ขาดอีก {n} kcal', { n: calShort }));
  if (waterShort > 0) statusLines.push(t('ยังดื่มน้ำไม่ถึงเป้า ขาดอีก {n} ml', { n: waterShort }));
  if (statusLines.length === 0) statusLines.push(t('วันนี้ทำได้ตามเป้าแล้ว'));

  const myUid = auth.currentUser?.uid;
  // ส่งหาตัวเองไม่ได้ (กฎ Firestore ก็บล็อก) และต้องรู้ว่าอยู่กลุ่มไหน ไม่งั้นซ่อนปุ่ม
  const canNudge = !!myUid && myUid !== m.uid && !!familyId;

  // เปิดหน้าต่าง: เติมข้อความตั้งต้นให้ แล้วอ่านชื่อผู้ส่งครั้งเดียว (ไม่อ่านซ้ำทุกครั้งที่เปิด)
  const openNudge = async () => {
    setNudgeText(statusLines[0]);
    setNudgeOpen(true);
    if (!myName && myUid) {
      const me = await getUserProfile(myUid);
      setMyName(me?.name || '');
      setMyPhoto(me?.photoURL || null);
    }
  };

  const handleSendNudge = async () => {
    const text = nudgeText.trim();
    if (!text) {
      Alert.alert(t('ผิดพลาด'), t('กรุณาพิมพ์ข้อความก่อนส่ง'));
      return;
    }
    setSending(true);
    const res = await sendNudge(familyId, {
      fromUid: myUid,
      fromName: myName,
      fromPhoto: myPhoto,
      toUid: m.uid,
      text,
    });
    setSending(false);
    if (res.success) {
      setNudgeOpen(false);
      Alert.alert(t('ส่งข้อความแล้ว'), t('{name} จะเห็นข้อความนี้ตอนเปิดแอป', { name: m.name }));
    } else {
      Alert.alert(t('ผิดพลาด'), t('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง'));
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#EAF6E0', '#F5FBF0', '#ffffff']} style={StyleSheet.absoluteFill} />

      <HeaderIn replayKey={replayKey}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#3F7D2C" />
          </TouchableOpacity>
          {m.photoURL ? (
            <Image source={{ uri: m.photoURL }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(m.name || '?').charAt(0)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{m.name}</Text>
            <Text style={styles.sub}>{t('อายุ {age} ปี', { age: m.age || '-' })} · {t(GOAL_TH[m.goal] || '-')}</Text>
          </View>
        </View>
      </HeaderIn>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 130 }}>
        {/* การ์ดแคลอรี่ — กินไปจริง */}
        <Appear index={0} replayKey={replayKey}>
          <LinearGradient colors={['#7FC97F', '#6FB84C']} style={styles.calCard}>
            <Text style={styles.calLabel}>{t('วันนี้กินไปแล้ว')}</Text>
            <Text style={styles.calValue}>
              {Math.round(eaten.calories)} <Text style={styles.calUnit}>/ {target || '-'} kcal</Text>
            </Text>
            <View style={styles.calTrack}>
              <View style={[styles.calFill, { width: `${target ? Math.min(eaten.calories / target, 1) * 100 : 0}%` }]} />
            </View>
            <Text style={styles.calNote}>
              {reached ? t('ถึงเป้าหมายแล้ว 🎉') : t('เหลืออีก {n} kcal', { n: Math.round(left) })}
            </Text>
          </LinearGradient>
        </Appear>

        {/* มาโคร กินไป/เป้า */}
        <Appear index={1} replayKey={replayKey}>
          <View style={styles.card}>
            <Bar label={t('คาร์โบไฮเดรต (g)')} eaten={eaten.carbs} target={m.carb} color="#F5B841" />
            <Bar label={t('โปรตีน (g)')} eaten={eaten.protein} target={m.protein} color="#7C4DBE" />
            <Bar label={t('ไขมัน (g)')} eaten={eaten.fat} target={m.fat} color="#D9702E" />
            <Bar label={t('น้ำ (ml)')} eaten={m.water?.current || 0} target={m.water?.target} color="#0891B2" />
          </View>

          {/* ปุ่มส่งข้อความเตือน — ซ่อนเมื่อกำลังดูหน้าของตัวเอง */}
          {canNudge && (
            <TouchableOpacity onPress={openNudge} activeOpacity={0.7} style={styles.remindBtn}>
              <Ionicons name="chatbubble-ellipses" size={18} color="#6FB84C" />
              <Text style={styles.remindBtnText}>{t('ส่งข้อความเตือน')}</Text>
            </TouchableOpacity>
          )}
        </Appear>

        {/* กราฟ 7 วันจริง */}
        <Appear index={2} replayKey={replayKey}>
          <Text style={styles.sectionTitle}>{t('แคลอรี่ 7 วันล่าสุด')}</Text>
          <View style={styles.card}>
            <View style={styles.chartRow}>
              {week.map((d, i) => {
                const h = (d.calories / maxVal) * 100;
                const isToday = i === week.length - 1;
                return (
                  <TouchableOpacity
                    key={d.dateKey}
                    style={styles.barCol}
                    activeOpacity={0.6}
                    onPress={() => openDay(d)}
                  >
                    <View style={styles.barArea}>
                      <View style={[styles.chartBar, {
                        height: `${Math.max(h, 2)}%`,
                        backgroundColor: isToday ? '#6FB84C' : '#C9E3B8',
                      }]} />
                    </View>
                    <Text style={[styles.barDay, isToday && { color: '#6FB84C', fontWeight: '800' }]}>
                      {d.day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Appear>

        {/* มื้ออาหารวันนี้ + รูป */}
        <Appear index={3} replayKey={replayKey}>
          <Text style={styles.sectionTitle}>
            {t('มื้ออาหารวันนี้ ({count})', { count: logs.length })}
          </Text>
        </Appear>

        {loading ? (
          <ActivityIndicator color="#6FB84C" style={{ marginTop: 16 }} />
        ) : logs.length === 0 ? (
          <Appear index={4} replayKey={replayKey}>
            <View style={styles.emptyCard}>
              <Ionicons name="fast-food-outline" size={32} color="#C9E3B8" />
              <Text style={styles.emptyText}>{t('ยังไม่มีบันทึกมื้ออาหารวันนี้')}</Text>
            </View>
          </Appear>
        ) : (
          grouped.map((g, i) => (
            <Appear key={g.key} index={i + 4} replayKey={replayKey}>
              <View style={styles.mealBlock}>
                <View style={styles.mealHead}>
                  <View style={styles.mealDot} />
                  <Text style={styles.mealTitle}>{g.label}</Text>
                  <Text style={styles.mealCal}>
                    {Math.round(g.items.reduce((s, i) => s + (i.calories || 0), 0))} kcal
                  </Text>
                </View>
                {g.items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.foodRow}
                    activeOpacity={0.7}
                    onPress={() => setPicked(item)}
                  >
                    {item.imageUri ? (
                      <Image source={{ uri: item.imageUri }} style={styles.foodImg} />
                    ) : (
                      <View style={styles.foodImgEmpty}>
                        <Ionicons name="fast-food-outline" size={20} color="#BBBBBB" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.foodName}>{item.name}</Text>
                      <Text style={styles.foodMeta}>
                        {Math.round(item.calories || 0)} kcal · {t('ป')} {Math.round(item.protein || 0)}g · {t('ค')} {Math.round(item.carbs || 0)}g · {t('ม')} {Math.round(item.fat || 0)}g
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </Appear>
          ))
        )}

        <Appear index={12} replayKey={replayKey}>
          <TouchableOpacity onPress={() => navigation.navigate('Insights', { member: m })}>
            <LinearGradient colors={['#7FC97F', '#6FB84C']} style={styles.insightBtn}>
              <Ionicons name="analytics" size={18} color="#fff" />
              <Text style={styles.insightBtnText}>{t('วิเคราะห์เชิงลึก')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.hint}>{t('* ดูข้อมูลได้อย่างเดียว แก้ไขของคนอื่นไม่ได้')}</Text>
        </Appear>
      </ScrollView>

      <Cover replayKey={replayKey} />

      {/* ---- หน้าต่างส่งข้อความเตือน ---- */}
      <Modal visible={nudgeOpen} transparent animationType="fade" onRequestClose={() => setNudgeOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalBody}>
              <Text style={styles.modalName}>{t('เตือน {name}', { name: m.name })}</Text>

              <Text style={styles.nudgeStatusHead}>{t('สถานะวันนี้')}</Text>
              {statusLines.map((line) => (
                <Text key={line} style={styles.nudgeStatusText}>{line}</Text>
              ))}

              <TextInput
                style={styles.nudgeInput}
                value={nudgeText}
                onChangeText={setNudgeText}
                placeholder={t('พิมพ์ข้อความ (ไม่เกิน 200 ตัว)')}
                placeholderTextColor="#9CA3AF"
                maxLength={200}
                multiline
              />

              <View style={styles.nudgeBtnRow}>
                <TouchableOpacity style={styles.nudgeCancel} onPress={() => setNudgeOpen(false)} disabled={sending}>
                  <Text style={styles.nudgeCancelText}>{t('ยกเลิก')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1 }} onPress={handleSendNudge} disabled={sending}>
                  <LinearGradient colors={['#7FC97F', '#6FB84C']} style={styles.nudgeSend}>
                    {sending ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.nudgeSendText}>{t('ส่ง')}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

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
              <Text style={styles.modalMeal}>{MEAL_LABELS[picked?.mealType] || ''}</Text>

              <LinearGradient colors={['#7FC97F', '#6FB84C']} style={styles.modalCal}>
                <Text style={styles.modalCalValue}>{Math.round(picked?.calories || 0)}</Text>
                <Text style={styles.modalCalUnit}>kcal</Text>
              </LinearGradient>

              <View style={styles.modalMacroRow}>
                <View style={[styles.modalMacro, { backgroundColor: '#FBF0DA' }]}>
                  <Text style={[styles.modalMacroVal, { color: '#C98A1F' }]}>{Math.round(picked?.carbs || 0)}g</Text>
                  <Text style={styles.modalMacroLabel}>{t('คาร์บ')}</Text>
                </View>
                <View style={[styles.modalMacro, { backgroundColor: '#EEE3F9' }]}>
                  <Text style={[styles.modalMacroVal, { color: '#7C4DBE' }]}>{Math.round(picked?.protein || 0)}g</Text>
                  <Text style={styles.modalMacroLabel}>{t('โปรตีน')}</Text>
                </View>
                <View style={[styles.modalMacro, { backgroundColor: '#FBE4D8' }]}>
                  <Text style={[styles.modalMacroVal, { color: '#D9702E' }]}>{Math.round(picked?.fat || 0)}g</Text>
                  <Text style={styles.modalMacroLabel}>{t('ไขมัน')}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!dayModal} transparent animationType="slide" onRequestClose={() => setDayModal(null)}>
        <View style={styles.daySheetBg}>
          <View style={styles.daySheet}>
            <View style={styles.daySheetHandle} />
            <View style={styles.daySheetHead}>
              <Text style={styles.daySheetTitle}>{t('วันที่ {day}', { day: dayModal?.day })}</Text>
              <TouchableOpacity onPress={() => setDayModal(null)}>
                <Ionicons name="close-circle" size={26} color="#ccc" />
              </TouchableOpacity>
            </View>

            {dayLoading ? (
              <ActivityIndicator color="#6FB84C" style={{ marginVertical: 30 }} />
            ) : dayModal?.logs?.length === 0 ? (
              <View style={styles.daySheetEmpty}>
                <Ionicons name="fast-food-outline" size={40} color="#C9E3B8" />
                <Text style={styles.daySheetEmptyText}>{t('วันนี้ไม่มีบันทึกมื้ออาหาร')}</Text>
              </View>
            ) : (
              <>
                <LinearGradient colors={['#7FC97F', '#6FB84C']} style={styles.dayTotalCard}>
                  <Text style={styles.dayTotalValue}>{Math.round(dayModal?.totals?.calories || 0)}</Text>
                  <Text style={styles.dayTotalUnit}>{t('kcal รวมทั้งวัน')}</Text>
                  <View style={styles.dayMacroRow}>
                    <Text style={styles.dayMacroText}>{t('ค')} {Math.round(dayModal?.totals?.carbs || 0)}g</Text>
                    <Text style={styles.dayMacroText}>{t('ป')} {Math.round(dayModal?.totals?.protein || 0)}g</Text>
                    <Text style={styles.dayMacroText}>{t('ม')} {Math.round(dayModal?.totals?.fat || 0)}g</Text>
                  </View>
                </LinearGradient>

                <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                  {dayModal?.logs.map((item) => (
                    <View key={item.id} style={styles.dayFoodRow}>
                      {item.imageUri ? (
                        <Image source={{ uri: item.imageUri }} style={styles.dayFoodImg} />
                      ) : (
                        <View style={styles.dayFoodImgEmpty}>
                          <Ionicons name="fast-food-outline" size={18} color="#BBB" />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dayFoodName}>{item.name}</Text>
                        <Text style={styles.dayFoodMeta}>
                          {MEAL_LABELS[item.mealType] || ''} · {Math.round(item.calories || 0)} kcal
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFillObject, backgroundColor: '#EAF6E0' },
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6FB84C', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: '#064e3b' },
  sub: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  calCard: { borderRadius: 22, padding: 22, marginBottom: 14 },
  calLabel: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  calValue: { fontSize: 34, fontWeight: '900', color: '#fff', marginTop: 4 },
  calUnit: { fontSize: 16, fontWeight: '600' },
  calTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  calFill: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },
  calNote: { fontSize: 12, color: 'rgba(255,255,255,0.95)', marginTop: 8, fontWeight: '600' },

  card: {
    backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },

  barTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  barLabel: { fontSize: 13, color: '#4b5563', fontWeight: '600' },
  barValue: { fontSize: 12, color: '#9ca3af', fontWeight: '700' },
  barTrack: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },

  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#064e3b', marginTop: 24, marginBottom: 12 },

  chartRow: { flexDirection: 'row', justifyContent: 'space-between', height: 110 },
  barCol: { flex: 1, alignItems: 'center' },
  barArea: { flex: 1, width: 14, justifyContent: 'flex-end' },
  chartBar: { width: 14, borderRadius: 7 },
  barDay: { fontSize: 11, color: '#9ca3af', marginTop: 6 },

  emptyCard: { backgroundColor: '#fff', borderRadius: 18, padding: 28, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, color: '#9ca3af' },

  mealBlock: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  mealHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  mealDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6FB84C' },
  mealTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  mealCal: { fontSize: 13, color: '#6FB84C', fontWeight: '700' },

  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  foodImg: { width: 48, height: 48, borderRadius: 12 },
  foodImgEmpty: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  foodName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  foodMeta: { fontSize: 11, color: '#9ca3af', marginTop: 2 },

  hint: { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 16 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 26, overflow: 'hidden' },
  modalImg: { width: '100%', height: 240 },
  modalImgEmpty: { backgroundColor: '#F4F4F4', alignItems: 'center', justifyContent: 'center' },
  closeBtn: {
    position: 'absolute', top: 14, right: 14,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { padding: 22 },
  modalName: { fontSize: 21, fontWeight: '800', color: '#111827' },
  modalMeal: { fontSize: 13, color: '#6FB84C', fontWeight: '700', marginTop: 3 },
  modalCal: {
    flexDirection: 'row', alignItems: 'baseline', gap: 6,
    borderRadius: 18, paddingVertical: 16, paddingHorizontal: 20, marginTop: 16,
  },
  modalCalValue: { fontSize: 34, fontWeight: '900', color: '#fff' },
  modalCalUnit: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  modalMacroRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalMacro: { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  modalMacroVal: { fontSize: 19, fontWeight: '800' },
  modalMacroLabel: { fontSize: 12, color: '#6b7280', marginTop: 3 },

  remindBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, paddingVertical: 14, marginTop: 8, marginBottom: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#6FB84C',
  },
  remindBtnText: { color: '#6FB84C', fontWeight: '800', fontSize: 15 },
  nudgeStatusHead: { fontSize: 13, fontWeight: '800', color: '#374151', marginTop: 16 },
  nudgeStatusText: { fontSize: 13, color: '#6B7280', marginTop: 4, lineHeight: 19 },
  nudgeInput: {
    minHeight: 88, borderRadius: 16, backgroundColor: '#F6F7F9',
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 14,
    fontSize: 14, color: '#1F2937', textAlignVertical: 'top',
  },
  nudgeBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  nudgeCancel: {
    paddingHorizontal: 22, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F6',
  },
  nudgeCancelText: { fontSize: 15, fontWeight: '700', color: '#4B5563' },
  nudgeSend: { borderRadius: 16, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  nudgeSendText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  insightBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 15, marginTop: 8, marginBottom: 8 },
  insightBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  daySheetBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  daySheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 34 },
  daySheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16 },
  daySheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  daySheetTitle: { fontSize: 19, fontWeight: '800', color: '#064e3b' },
  daySheetEmpty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  daySheetEmptyText: { fontSize: 14, color: '#9ca3af' },
  dayTotalCard: { borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 16 },
  dayTotalValue: { fontSize: 38, fontWeight: '900', color: '#fff' },
  dayTotalUnit: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  dayMacroRow: { flexDirection: 'row', gap: 18, marginTop: 12 },
  dayMacroText: { fontSize: 14, color: '#fff', fontWeight: '700' },
  dayFoodRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  dayFoodImg: { width: 44, height: 44, borderRadius: 10 },
  dayFoodImgEmpty: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  dayFoodName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  dayFoodMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
});