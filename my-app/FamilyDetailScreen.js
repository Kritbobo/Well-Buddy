import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Alert, Modal, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { auth } from './firebase';
import { getFamilyDetail, leaveFamily, deleteFamily } from './familyService';
import { useLang } from './LanguageContext';

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

// แถบ progress: กินไป / เป้าหมาย — width คิดตรง ๆ ไม่ต้อง animate
function Bar({ label, eaten, target, color }) {
  const pct = target ? Math.min(eaten / target, 1) : 0;

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={styles.barTop}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{eaten} / {target || '-'}</Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${pct * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

// การ์ดสมาชิก 1 ใบ (แอนิเมชันอยู่ที่ Appear ที่ห่ออยู่ข้างนอก)
function MemberCard({ member: m, onPress }) {
  const { t } = useLang();
  const [imgErr, setImgErr] = React.useState(false);
  const validPhoto = (!imgErr && m.photoURL && !m.photoURL.startsWith('file://')) ? m.photoURL : null;

  return (
    <TouchableOpacity style={styles.memberCard} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.memberHead}>
        {validPhoto ? (
          <Image source={{ uri: validPhoto }} style={styles.avatarImg} onError={() => setImgErr(true)} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(m.name || '?').charAt(0)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.memberName}>{m.name}</Text>
            {m.isOwner && (
              <View style={styles.ownerBadge}>
                <Text style={styles.ownerText}>{t('เจ้าของ')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.memberAge}>{t('อายุ {age} ปี', { age: m.age || '-' })}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#c0c0c0" />
      </View>

      {/* progress: กินไปวันนี้ / เป้าหมาย */}
      <Bar label={t('คาร์โบไฮเดรต')} eaten={m.eaten?.carbs || 0} target={m.carb} color="#F5B841" />
      <Bar label={t('โปรตีน')} eaten={m.eaten?.protein || 0} target={m.protein} color="#7C4DBE" />
      <Bar label={t('ไขมัน')} eaten={m.eaten?.fat || 0} target={m.fat} color="#D9702E" />
      <Bar label={t('แคลอรี่')} eaten={m.eaten?.calories || 0} target={m.calories} color="#6FB84C" />
      {/* ใช้ 'น้ำดื่ม' ไม่ใช่ 'น้ำ' เพราะคำว่า 'น้ำ' แปลเป็น Drinks ไว้แล้วสำหรับหมวดตู้เย็น */}
      <Bar label={t('น้ำดื่ม')} eaten={m.water?.current || 0} target={m.water?.target} color="#0891B2" />

      <Text style={styles.detailLink}>{t('ดูรายละเอียด ›')}</Text>
    </TouchableOpacity>
  );
}

export default function FamilyDetailScreen({ navigation, route }) {
  const { familyId } = route.params;
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getFamilyDetail(familyId).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [familyId]);

  useFocusEffect(load);

  // ---- แอนิเมชัน: เล่นใหม่ทุกครั้งที่เข้าหน้า (แพทเทิร์นเดียวกับ ChatScreen) ----
  // hooks ต้องอยู่ก่อน early return ด้านล่าง
  const [replayKey, setReplayKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setReplayKey((k) => k + 1); // การ์ดทุกใบรีเซ็ตแล้วเล่นใหม่ตอนเข้าหน้า
    }, [])
  );

  const copyCode = async () => {
    if (!data?.family?.inviteCode) return;
    await Clipboard.setStringAsync(data.family.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#6FB84C" size="large" /></View>;
  }
  if (!data) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errText}>{t('ไม่พบข้อมูลครอบครัว')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>{t('กลับ')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { family, members } = data;

  const myUid = auth.currentUser?.uid;
  const isOwner = family?.ownerUid === myUid;

  const handleLeave = () => {
    Alert.alert(
      t('ออกจากครอบครัว'),
      t('ต้องการออกจาก "{name}" ใช่ไหม? คุณจะไม่เห็นข้อมูลของสมาชิกอีก', { name: family.name }),
      [
        { text: t('ยกเลิก'), style: 'cancel' },
        {
          text: t('ออกจากกลุ่ม'),
          style: 'destructive',
          onPress: async () => {
            const res = await leaveFamily(myUid, familyId);
            if (res.success) {
              navigation.goBack();
            } else {
              Alert.alert(t('ไม่สำเร็จ'), res.message);
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      t('ลบครอบครัว'),
      t('ต้องการลบ "{name}" ใช่ไหม?\nสมาชิกทั้ง {count} คนจะหลุดออกจากกลุ่ม และลบแล้วกู้คืนไม่ได้', {
        name: family.name,
        count: members.length,
      }),
      [
        { text: t('ยกเลิก'), style: 'cancel' },
        {
          text: t('ลบกลุ่ม'),
          style: 'destructive',
          onPress: async () => {
            const res = await deleteFamily(myUid, familyId);
            if (res.success) {
              navigation.goBack();
            } else {
              Alert.alert(t('ไม่สำเร็จ'), res.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#EAF6E0', '#F5FBF0', '#ffffff']} style={StyleSheet.absoluteFill} />

      {/* header เขียวอ่อน */}
      <HeaderIn replayKey={replayKey}>
        <LinearGradient
          colors={['#7FC97F', '#A8D97F']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 12 }]}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#3F7D2C" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>{t('สุขภาพครอบครัว')}</Text>
            <Text style={styles.headerTitle}>{family.name}</Text>
          </View>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)}>
            <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>
      </HeaderIn>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 130 }}>
        {/* การ์ดรหัสเชิญ */}
        <Appear index={0} replayKey={replayKey}>
          <View style={styles.codeCard}>
            <View style={styles.codeIcon}>
              <Ionicons name="person-add" size={22} color="#6FB84C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.codeTitle}>{t('เพิ่มครอบครัว')}</Text>
              <Text style={styles.codeDesc}>{t('แชร์รหัสให้คนในบ้านเข้าร่วม')}</Text>
            </View>
          </View>
        </Appear>

        <Appear index={1} replayKey={replayKey}>
          <LinearGradient colors={['#7FC97F', '#6FB84C']} style={styles.codeBox}>
            <View>
              <Text style={styles.codeBoxLabel}>{t('โค้ดเชิญ')}</Text>
              <Text style={styles.codeBoxValue}>{family.inviteCode}</Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={copyCode}>
              <Ionicons name={copied ? 'checkmark' : 'copy'} size={16} color="#fff" />
              <Text style={styles.copyText}>{copied ? t('คัดลอกแล้ว') : t('คัดลอก')}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Appear>

        {/* สมาชิก */}
        {members.map((m, i) => (
          <Appear key={m.uid} index={i + 2} replayKey={replayKey}>
            <MemberCard
              member={m}
              onPress={() => navigation.navigate('MemberDetail', { member: m, familyId })}
            />
          </Appear>
        ))}

        <Text style={styles.hint}>{t('* ดูข้อมูลได้อย่างเดียว แก้ไขของคนอื่นไม่ได้')}</Text>
      </ScrollView>

      <Cover replayKey={replayKey} />

      {/* เมนู 3 จุด — action sheet เลื่อนขึ้นจากล่าง */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.sheetBg}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <TouchableOpacity style={styles.sheet} activeOpacity={1}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{family.name}</Text>

            {isOwner ? (
              <TouchableOpacity
                style={styles.sheetItem}
                onPress={() => {
                  setMenuVisible(false);
                  handleDelete();
                }}
              >
                <Ionicons name="trash-outline" size={20} color="#DC2626" />
                <Text style={[styles.sheetItemText, { color: '#DC2626' }]}>{t('ลบครอบครัวนี้')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.sheetItem}
                onPress={() => {
                  setMenuVisible(false);
                  handleLeave();
                }}
              >
                <Ionicons name="exit-outline" size={20} color="#EA580C" />
                <Text style={[styles.sheetItemText, { color: '#EA580C' }]}>{t('ออกจากครอบครัว')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.sheetItem}
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate('SeedData');
              }}
            >
              <Ionicons name="sparkles-outline" size={20} color="#2563EB" />
              <Text style={[styles.sheetItemText, { color: '#2563EB' }]}>{t('สร้างข้อมูลตัวอย่าง')}</Text>
            </TouchableOpacity>

            <View style={styles.sheetDivider} />

            <TouchableOpacity style={styles.sheetItem} onPress={() => setMenuVisible(false)}>
              <Ionicons name="close" size={20} color="#6b7280" />
              <Text style={[styles.sheetItemText, { color: '#6b7280' }]}>{t('ยกเลิก')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFillObject, backgroundColor: '#EAF6E0' },
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5FBF0', gap: 10 },
  errText: { fontSize: 16, fontWeight: '700', color: '#374151' },
  backLink: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#6FB84C', borderRadius: 14 },
  backLinkText: { color: '#fff', fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 18,
    borderBottomLeftRadius: 26, borderBottomRightRadius: 26,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },

  codeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  codeIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EAF6E0', alignItems: 'center', justifyContent: 'center' },
  codeTitle: { fontSize: 16, fontWeight: '800', color: '#3F7D2C' },
  codeDesc: { fontSize: 13, color: '#9ca3af', marginTop: 2 },

  codeBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 18, padding: 18, marginBottom: 20,
  },
  codeBoxLabel: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  codeBoxValue: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: 4, marginTop: 2 },
  copyBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  copyText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  memberCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  memberHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6FB84C', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  memberAge: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  ownerBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  ownerText: { fontSize: 10, fontWeight: '700', color: '#d97706' },

  barTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  barLabel: { fontSize: 13, color: '#4b5563', fontWeight: '600' },
  barValue: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  barTrack: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },

  detailLink: { fontSize: 12, color: '#6FB84C', fontWeight: '700', textAlign: 'right', marginTop: 4 },
  hint: { fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 14 },

  menuBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },

  sheetBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 10, paddingBottom: 30,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0',
    alignSelf: 'center', marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 13, color: '#9ca3af', fontWeight: '600',
    paddingHorizontal: 22, paddingBottom: 8,
  },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    height: 56, paddingHorizontal: 22,
  },
  sheetItemText: { fontSize: 15, fontWeight: '700' },
  sheetDivider: { height: 1, backgroundColor: '#F1F1F1', marginHorizontal: 22 },
});