import React, { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, TextInput, Image,
  ActivityIndicator, Alert, RefreshControl, LayoutAnimation,
  Platform, UIManager, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from './firebase';
import {
  getNotifications, markAllRead, clearAllNotifications, syncFamilyNotifications,
  deleteNotification, syncNudges,
} from './notificationCenterService';
import { testNotification } from './notificationService';
import { useLang } from './LanguageContext';
import { translate, MONTHS_SHORT, DAYS_SHORT } from './appI18n';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TABS = [
  { key: 'all',    label: 'ทั้งหมด' },
  { key: 'family', label: 'ครอบครัว' },
  { key: 'me',     label: 'ของฉัน' },
];

const ICONS = {
  'family-join':  { name: 'person-add-outline',   fg: '#2563EB', bg: '#DBEAFE' },
  'family-water': { name: 'water-outline',        fg: '#0891B2', bg: '#CFFAFE' },
  'family-meal':  { name: 'restaurant-outline',   fg: '#EA580C', bg: '#FFEDD5' },
  'family-over':  { name: 'alert-circle-outline', fg: '#D97706', bg: '#FEF3C7' },
  water:          { name: 'water-outline',        fg: '#0891B2', bg: '#CFFAFE' },
  meal:           { name: 'restaurant-outline',   fg: '#EA580C', bg: '#FFEDD5' },
  over:           { name: 'alert-circle-outline', fg: '#D97706', bg: '#FEF3C7' },
  summary:        { name: 'moon-outline',         fg: '#7C3AED', bg: '#EDE9FE' },
  expiry:         { name: 'snow-outline',         fg: '#0284C7', bg: '#E0F2FE' },
  nudge:          { name: 'chatbubble-ellipses-outline', fg: '#DB2777', bg: '#FCE7F3' },
  test:           { name: 'flask-outline',        fg: '#6B7280', bg: '#F3F4F6' },
};

// วงกลมหน้ารายการ — ข้อความจากคนในครอบครัวที่มีรูปโปรไฟล์ ให้โชว์รูปแทนไอคอน
// แยก component เพราะต้องมี imgErr เป็นของตัวเองรายการต่อรายการ
// file:// = path ในเครื่องคนส่ง เครื่องเราเปิดไม่ได้ ตกกลับไปใช้ไอคอน
function RowAvatar({ n, ic }) {
  const [imgErr, setImgErr] = useState(false);
  const photo = n.meta?.fromPhoto;
  const validPhoto =
    n.type === 'nudge' && !imgErr && photo && !String(photo).startsWith('file://') ? photo : null;

  if (validPhoto) {
    return (
      <Image source={{ uri: validPhoto }} style={styles.avatar} onError={() => setImgErr(true)} />
    );
  }
  return (
    <View style={[styles.avatar, { backgroundColor: ic.bg }]}>
      <Ionicons name={ic.name} size={20} color={ic.fg} />
    </View>
  );
}

// 3 ฟังก์ชันนี้อยู่นอก component เลยเรียก hook ไม่ได้ — รับ lang เข้ามาแล้วใช้ translate ตรง ๆ
// (translate เป็นฟังก์ชันธรรมดา ไม่ใช่ hook) ชื่อเดือน/ชื่อวันดึงจาก i18n.js ที่เดียว
function dayLabel(d, lang) {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(d); b.setHours(0, 0, 0, 0);
  const diff = Math.round((a - b) / 86400000);
  if (diff === 0) return translate(lang, 'วันนี้');
  if (diff === 1) return translate(lang, 'เมื่อวาน');
  if (lang === 'en') {
    return `${DAYS_SHORT.en[b.getDay()]} ${b.getDate()} ${MONTHS_SHORT.en[b.getMonth()]}`;
  }
  return `วัน${DAYS_SHORT.th[b.getDay()]}ที่ ${b.getDate()} ${MONTHS_SHORT.th[b.getMonth()]}`;
}

function timeAgo(d, lang) {
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return translate(lang, 'เมื่อสักครู่');
  if (min < 60) return translate(lang, '{n} นาที', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return translate(lang, '{n} ชม.', { n: hr });
  return translate(lang, '{n} วัน', { n: Math.floor(hr / 24) });
}

function groupByDay(list, lang) {
  const map = new Map();
  list.forEach((n) => {
    const key = dayLabel(n.createdAt, lang);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(n);
  });
  return Array.from(map, ([label, rows]) => ({ label, rows }));
}

export default function NotificationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { lang, t, ready } = useLang();
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const uid = auth.currentUser?.uid;

  const load = useCallback(async (silent) => {
    if (!uid) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      // สร้างแจ้งเตือนใหม่ก็ต่อเมื่ออ่านภาษาเสร็จแล้ว ไม่งั้นข้อความจะติดภาษา default
      // ส่วนการอ่านรายการเดิมทำได้เสมอ ไม่ต้องรอ
      if (ready) {
        await syncFamilyNotifications(uid);
        await syncNudges(uid); // หยิบข้อความเตือนจากคนในครอบครัวเข้ากล่องตัวเอง
      }
      setItems(await getNotifications(uid));
    } catch (e) {
      console.log('notification load error:', e);
    }
    setLoading(false);
    setRefreshing(false);
  }, [uid, ready]);

  // โหลดตอนเข้าหน้า / ทำเครื่องหมายอ่านแล้วตอนออกจากหน้า
  useFocusEffect(
    useCallback(() => {
      load();
      return () => { if (uid) markAllRead(uid).catch(() => {}); };
    }, [load, uid, ready])
  );

  // nudge = ข้อความที่คนในครอบครัวส่งมา จึงนับเป็นแท็บครอบครัวด้วย ชนิดอื่นคิดเหมือนเดิม
  const isFamily = (n) => n.type?.startsWith('family-') || n.type === 'nudge';

  const byTab = items.filter((n) =>
    tab === 'all' ? true : tab === 'family' ? isFamily(n) : !isFamily(n)
  );

  const q = search.trim().toLowerCase();
  const filtered = q
    ? byTab.filter(
        (n) =>
          n.title?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q)
      )
    : byTab;

  const countOf = (k) =>
    k === 'all' ? items.length
      : k === 'family' ? items.filter(isFamily).length
      : items.filter((n) => !isFamily(n)).length;

  const sections = groupByDay(filtered, lang);
  const unreadTotal = items.filter((n) => !n.read).length;

  const readAll = async () => {
    await markAllRead(uid);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // กดค้างที่รายการ → ยืนยันแล้วลบเฉพาะรายการนั้น
  // ตัดออกจาก state เลย ไม่ต้องโหลดใหม่ทั้งก้อน (countOf คิดจาก items เลขบนแท็บจึงลดตาม)
  const confirmDelete = (n) => {
    Alert.alert(t('ลบรายการนี้'), t('ลบการแจ้งเตือนนี้ออกจากรายการ'), [
      { text: t('ยกเลิก'), style: 'cancel' },
      {
        text: t('ลบ'),
        style: 'destructive',
        onPress: async () => {
          const ok = await deleteNotification(uid, n.id);
          if (ok) setItems((prev) => prev.filter((x) => x.id !== n.id));
        },
      },
    ]);
  };

  const clear = () => {
    Alert.alert(t('ล้างการแจ้งเตือน'), t('ลบรายการแจ้งเตือนทั้งหมดออกจากระบบ'), [
      { text: t('ยกเลิก'), style: 'cancel' },
      {
        text: t('ล้างเลย'), style: 'destructive',
        onPress: async () => { await clearAllNotifications(uid); setItems([]); },
      },
    ]);
  };

  const toggleTest = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTestOpen((v) => !v);
  };

  const fire = async (title, body) => {
    Keyboard.dismiss();
    await testNotification({ title, body, seconds: 3 });
    Alert.alert('ตั้งคิวแล้ว', 'จะเด้งใน 3 วินาที ล็อกหน้าจอเพื่อดูผลบน Lock Screen ได้เลย');
  };

  const TESTS = [
    { type: 'meal',        label: 'เตือนมื้อเช้า',       title: 'ยังไม่ได้บันทึกมื้อเช้า',   body: 'อย่าลืมกินมื้อเช้าและบันทึกลงแอปด้วยนะ' },
    { type: 'meal',        label: 'เตือนมื้อเย็น',       title: 'ยังไม่ได้บันทึกมื้อเย็น',   body: 'วันนี้เหลืออีก 1,240 kcal อย่าลืมกินและบันทึกด้วยนะ' },
    { type: 'water',       label: 'เตือนดื่มน้ำ',        title: 'ยังดื่มน้ำไม่ถึงเป้า',      body: 'ตอนนี้ควรดื่มได้ประมาณ 1,150 ml แล้ว คุณดื่มไป 400 ml ขาดอีก 750 ml' },
    { type: 'family-over', label: 'ครอบครัวกินเกินเป้า', title: 'แม่ กินเกินเป้าหมาย',       body: 'แม่ กินไป 3,180 kcal เกินเป้าไป 320 kcal แล้ววันนี้' },
    { type: 'expiry',      label: 'ของใกล้หมดอายุ',      title: 'มีของในตู้เย็นใกล้หมดอายุ', body: 'หมูสด, นมสด กำลังจะหมดอายุภายใน 2 วัน อย่าลืมนำมาทำอาหารนะ' },
    { type: 'summary',     label: 'สรุปประจำวัน',        title: 'สรุปวันนี้',                body: 'กินไป 1,820 / 2,861 kcal · น้ำ 1,400 / 2,230 ml ยังขาดอีก 830 ml' },
  ];

  return (
    <View style={styles.root}>
      {/* ---- หัวข้อ ---- */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#3C4149" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('การแจ้งเตือน')}</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* ---- ช่องค้นหา ---- */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={19} color="#8B919B" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('ค้นหาการแจ้งเตือน')}
          placeholderTextColor="#A7ACB4"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#B6BBC3" />
          </TouchableOpacity>
        )}
      </View>

      {/* ---- แถบกรอง ---- */}
      <View style={styles.filterRow}>
        <View style={styles.pillGroup}>
          {TABS.map((item) => {
            const on = tab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.pill, on && styles.pillOn]}
                onPress={() => setTab(item.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, on && styles.pillTextOn]}>{t(item.label)}</Text>
                <View style={[styles.pillBadge, on && styles.pillBadgeOn]}>
                  <Text style={styles.pillBadgeText}>{countOf(item.key)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {unreadTotal > 0 && (
          <TouchableOpacity onPress={readAll}>
            <Text style={styles.readAll}>อ่านทั้งหมด</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerAll}>
          <ActivityIndicator size="large" color="#6FB84C" />
          <Text style={styles.dim}>กำลังตรวจสอบการแจ้งเตือน...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor="#6FB84C"
            />
          }
        >
          {sections.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name={q ? 'search-outline' : 'notifications-off-outline'}
                  size={34} color="#C4C9D0"
                />
              </View>
              <Text style={styles.emptyTitle}>
                {q ? t('ไม่พบการแจ้งเตือนที่ค้นหา') : t('ยังไม่มีการแจ้งเตือน')}
              </Text>
              <Text style={styles.emptyText}>
                {q
                  ? t('ไม่มีรายการที่ตรงกับ "{q}"', { q: search.trim() })
                  : tab === 'family'
                    ? t('เมื่อคนในครอบครัวมีความเคลื่อนไหว\nจะแสดงที่นี่')
                    : t('เมื่อมีความเคลื่อนไหวของคุณ\nจะแสดงที่นี่')}
              </Text>
            </View>
          ) : (
            sections.map((sec) => (
              <View key={sec.label}>
                <Text style={styles.sectionLabel}>{sec.label}</Text>

                {sec.rows.map((n) => {
                  const ic = ICONS[n.type] || ICONS.test;
                  const canOpen = isFamily(n) && !!n.meta?.familyId;
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={styles.row}
                      activeOpacity={canOpen ? 0.6 : 1}
                      // เลิกใช้ disabled เพราะมันบล็อก onLongPress ด้วย — ใช้ onPress เป็น
                      // undefined แทน กดแล้วไม่มีอะไรเกิดเหมือนเดิม แต่กดค้างเพื่อลบได้ทุกรายการ
                      onPress={
                        canOpen
                          ? () => navigation.navigate('FamilyDetail', { familyId: n.meta.familyId })
                          : undefined
                      }
                      onLongPress={() => confirmDelete(n)}
                      delayLongPress={350}
                    >
                      <RowAvatar n={n} ic={ic} />

                      <View style={styles.rowBody}>
                        {/* บรรทัดบน: หัวข้อ + จุด */}
                        <View style={styles.line}>
                          <Text
                            style={[styles.rowTitle, n.read && styles.readTitle]}
                            numberOfLines={1}
                          >
                            {n.title}
                          </Text>
                          {!n.read && <View style={styles.dot} />}
                        </View>

                        {/* บรรทัดล่าง: เนื้อหา + เวลาชิดขวา */}
                        <View style={styles.line}>
                          <Text
                            style={[styles.rowText, n.read && styles.readText]}
                            numberOfLines={1}
                          >
                            {n.body}
                          </Text>
                          <Text style={styles.rowTime}>{timeAgo(n.createdAt, lang)}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}

          {items.length > 0 && (
            <TouchableOpacity style={styles.clearRow} onPress={clear}>
              <Text style={styles.clearText}>ล้างการแจ้งเตือนทั้งหมด</Text>
            </TouchableOpacity>
          )}

          {/* ---- ส่วนทดสอบ ล่างสุดเสมอ ---- */}
          <TouchableOpacity style={styles.testHead} onPress={toggleTest} activeOpacity={0.7}>
            <Ionicons name="construct-outline" size={15} color="#9CA3AF" />
            <Text style={styles.testHeadText}>ทดสอบระบบแจ้งเตือน</Text>
            <Ionicons name={testOpen ? 'chevron-up' : 'chevron-down'} size={15} color="#9CA3AF" />
          </TouchableOpacity>

          {testOpen && (
            <View style={styles.testBox}>
              <Text style={styles.testHint}>
                กดแล้วจะเด้งใน 3 วินาที ล็อกหน้าจอเพื่อดูผลบน Lock Screen
              </Text>
              {TESTS.map((t) => {
                const ic = ICONS[t.type] || ICONS.test;
                return (
                  <TouchableOpacity
                    key={t.label}
                    style={styles.testItem}
                    onPress={() => fire(t.title, t.body)}
                  >
                    <View style={[styles.testIcon, { backgroundColor: ic.bg }]}>
                      <Ionicons name={ic.name} size={15} color={ic.fg} />
                    </View>
                    <Text style={styles.testLabel}>{t.label}</Text>
                    <Ionicons name="play-outline" size={17} color="#6FB84C" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const AVATAR = 44;
const GUTTER = 18;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FBFCFD' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 10,
  },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#3C4149' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    marginHorizontal: GUTTER, marginBottom: 14,
    paddingHorizontal: 15, height: 46,
    borderRadius: 23, backgroundColor: '#EFF1F4',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#3C4149', padding: 0 },

  filterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: GUTTER, paddingBottom: 6,
  },
  pillGroup: { flexDirection: 'row', gap: 7 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 5, paddingLeft: 12, paddingRight: 5,
    borderRadius: 999, backgroundColor: '#EDF3E8',
  },
  pillOn: { backgroundColor: '#DCEBD0' },
  pillText: { fontSize: 12.5, fontWeight: '500', color: '#5E7A50' },
  pillTextOn: { color: '#2F6B18', fontWeight: '700' },
  pillBadge: {
    minWidth: 22, height: 22, paddingHorizontal: 6,
    borderRadius: 11, backgroundColor: '#9BC47F',
    alignItems: 'center', justifyContent: 'center',
  },
  pillBadgeOn: { backgroundColor: '#4E9C2E' },
  pillBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  readAll: { fontSize: 12.5, fontWeight: '500', color: '#4E9C2E' },

  centerAll: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { marginTop: 12, fontSize: 13, color: '#9CA3AF' },

  sectionLabel: {
    fontSize: 14.5, fontWeight: '700', color: '#1A1D23',
    paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: 4,
  },

  row: { flexDirection: 'row', paddingLeft: GUTTER, paddingTop: 18 },
  avatar: {
    width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2,
    alignItems: 'center', justifyContent: 'center',
  },
  rowBody: {
    flex: 1, marginLeft: 13, paddingRight: GUTTER, paddingBottom: 18,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4E7EB',
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1A1D23' },
  readTitle: { color: '#6B7280', fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4E9C2E' },
  rowText: { flex: 1, fontSize: 13, color: '#5A616B', marginTop: 4 },
  readText: { color: '#8B919B' },
  rowTime: { fontSize: 11.5, color: '#8B919B', marginTop: 4, fontWeight: '500' },

  emptyBox: { alignItems: 'center', paddingVertical: 80 },
  emptyIcon: {
    width: 74, height: 74, borderRadius: 37, backgroundColor: '#F1F3F6',
    alignItems: 'center', justifyContent: 'center', marginBottom: 15,
  },
  emptyTitle: { fontSize: 14.5, fontWeight: '600', color: '#4B5563' },
  emptyText: { fontSize: 12.5, color: '#A9AFB8', textAlign: 'center', marginTop: 7, lineHeight: 19 },

  clearRow: { alignItems: 'center', paddingVertical: 20 },
  clearText: { fontSize: 12.5, color: '#DC2626', fontWeight: '500' },

  testHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: GUTTER, marginTop: 4,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 12, backgroundColor: '#F2F4F7',
  },
  testHeadText: { flex: 1, fontSize: 12.5, fontWeight: '500', color: '#9CA3AF' },
  testBox: { marginHorizontal: GUTTER, marginTop: 4 },
  testHint: { fontSize: 11, color: '#B0B6BE', paddingVertical: 8, lineHeight: 17 },
  testItem: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11 },
  testIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  testLabel: { flex: 1, fontSize: 13, color: '#4B5563', fontWeight: '500' },
});