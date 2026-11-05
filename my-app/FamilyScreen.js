import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Modal, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from './firebase';
import { createFamily, joinFamily, getMyFamilies } from './familyService';
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
      delay: index * 50,   // โผล่ทีละอัน
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

// การ์ดครอบครัว 1 ใบ (แอนิเมชันอยู่ที่ Appear ที่ห่ออยู่ข้างนอก)
function FamilyCard({ family: f, onPress }) {
  const { t } = useLang();

  return (
    <TouchableOpacity style={styles.famCard} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.famIcon}>
        <Ionicons name="home" size={22} color="#059669" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.famTop}>
          <Text style={styles.famName}>{f.name}</Text>
          {f.isOwner && (
            <View style={styles.ownerBadge}>
              <Text style={styles.ownerText}>{t('เจ้าของ')}</Text>
            </View>
          )}
        </View>
        <Text style={styles.famMeta}>
          {t('{count} สมาชิก · รหัส {code}', { count: f.memberCount, code: f.inviteCode })}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );
}

export default function FamilyScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setLoading(true);
    getMyFamilies(uid).then((data) => {
      setFamilies(data);
      setLoading(false);
    });
  }, []);

  // โหลดใหม่ทุกครั้งที่กลับมาหน้านี้ (เผื่อสร้าง/เข้าร่วมกลุ่มมาจากที่อื่น)
  useFocusEffect(load);

  // ---- แอนิเมชัน: เล่นใหม่ทุกครั้งที่เข้าหน้า (แพทเทิร์นเดียวกับ ChatScreen) ----
  const [replayKey, setReplayKey] = useState(0);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const coverAnim = useRef(new Animated.Value(1)).current; // ผ้าคลุม: 1 = ทึบ

  useFocusEffect(
    useCallback(() => {
      // รีเซ็ตกลับจุดเริ่มก่อน แล้วค่อยเล่น
      headerAnim.setValue(0);
      coverAnim.setValue(1);
      setReplayKey((k) => k + 1);

      Animated.timing(headerAnim, {
        toValue: 1, duration: 450, useNativeDriver: true,
      }).start();
      // ผ้าคลุมสีพื้นค่อย ๆ เปิดออก พร้อมจังหวะเดียวกับการ์ด
      Animated.timing(coverAnim, {
        toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true,
      }).start();
    }, [])
  );

  const handleJoin = async () => {
    if (!code.trim()) {
      Alert.alert(t('กรอกรหัส'), t('กรุณากรอกรหัสเชิญก่อน'));
      return;
    }
    setJoining(true);
    const res = await joinFamily(auth.currentUser.uid, code);
    setJoining(false);
    if (res.success) {
      setCode('');
      load();
      Alert.alert(t('สำเร็จ'), t('เข้าร่วมครอบครัวเรียบร้อย'));
    } else {
      Alert.alert(t('เข้าร่วมไม่สำเร็จ'), res.message);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    const res = await createFamily(auth.currentUser.uid, newName);
    setCreating(false);
    if (res.success) {
      setShowCreate(false);
      setNewName('');
      load();
      Alert.alert(
        t('สร้างสำเร็จ'),
        t('รหัสเชิญของกลุ่มคือ {code}\nแชร์ให้คนในครอบครัวเข้าร่วมได้เลย', { code: res.code })
      );
    } else {
      Alert.alert(t('สร้างไม่สำเร็จ'), res.message);
    }
  };

  return (
    <View style={styles.root}>
      {/* header เขียว — ไหลลงมาจากบน (ค่าเดียวกับ header ของ ChatScreen) */}
      <Animated.View
        style={{
          opacity: headerAnim,
          transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
        }}
      >
        <LinearGradient
          colors={['#7FC97F', '#A8D97F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 12 }]}
        >
          <View>
            <Text style={styles.headerSub}>{t('แชร์สุขภาพ')}</Text>
            <Text style={styles.headerTitle}>{t('ครอบครัว')}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
            <Ionicons name="add" size={24} color="#6FB84C" />
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 130 }}>
        {/* กล่องเข้าร่วมด้วยรหัส */}
        <Appear index={0} replayKey={replayKey}>
          <View style={styles.joinCard}>
            <Text style={styles.joinLabel}>{t('มีรหัสเชิญอยู่แล้ว?')}</Text>
            <View style={styles.joinRow}>
              <TextInput
                style={styles.codeInput}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder={t('กรอกรหัส 6 ตัว')}
                placeholderTextColor="#9ca3af"
                autoCapitalize="characters"
                maxLength={6}
              />
              <TouchableOpacity onPress={handleJoin} disabled={joining}>
                <LinearGradient colors={['#7FC97F', '#6FB84C']} style={styles.joinBtn}>
                  {joining ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.joinBtnText}>{t('เข้าร่วม')}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Appear>

        {/* รายการครอบครัว */}
        <Text style={styles.sectionTitle}>{t('ครอบครัวของฉัน')}</Text>

        {loading ? (
          <ActivityIndicator color="#059669" style={{ marginTop: 30 }} />
        ) : families.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color="#a7f3d0" />
            <Text style={styles.emptyText}>{t('ยังไม่มีครอบครัว')}</Text>
            <Text style={styles.emptySub}>{t('สร้างใหม่ หรือเข้าร่วมด้วยรหัสเชิญ')}</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreate(true)}>
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.emptyBtnText}>{t('สร้างครอบครัว')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          families.map((f, index) => (
            <Appear key={f.id} index={index + 1} replayKey={replayKey}>
              <FamilyCard
                family={f}
                onPress={() => navigation.navigate('FamilyDetail', { familyId: f.id })}
              />
            </Appear>
          ))
        )}
      </ScrollView>

      {/* ผ้าคลุมสีพื้น — เปิดออกตอนเข้าหน้า (ไม่ fade เนื้อหา เพราะการ์ดมีเงาแล้วจะดูคล้ำ) */}
      <Animated.View pointerEvents="none" style={[styles.cover, { opacity: coverAnim }]} />

      {/* modal สร้างครอบครัว */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('สร้างครอบครัวใหม่')}</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder={t('ชื่อครอบครัว เช่น บ้านคุณมิว')}
              placeholderTextColor="#9ca3af"
            />
            <View style={styles.modalRow}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setShowCreate(false); setNewName(''); }}
              >
                <Text style={styles.modalCancelText}>{t('ยกเลิก')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} disabled={creating} style={{ flex: 1 }}>
                <LinearGradient colors={['#7FC97F', '#6FB84C']} style={styles.modalCreate}>
                  {creating ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalCreateText}>{t('สร้าง')}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F9F5' },
  cover: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F7F9F5' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  addBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#059669', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },

  joinCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  joinLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
  joinRow: { flexDirection: 'row', gap: 10 },
  codeInput: {
    flex: 1, backgroundColor: '#f3f4f6', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 16, letterSpacing: 2,
    color: '#111827', fontWeight: '700',
  },
  joinBtn: { paddingHorizontal: 22, paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#064e3b', marginTop: 28, marginBottom: 14 },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 8 },
  emptySub: { fontSize: 13, color: '#9ca3af' },
  emptyBtn: {
    flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 16,
    backgroundColor: '#059669', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  famCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  famIcon: {
    width: 46, height: 46, borderRadius: 14, backgroundColor: '#d1fae5',
    alignItems: 'center', justifyContent: 'center',
  },
  famTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  famName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  ownerBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  ownerText: { fontSize: 10, fontWeight: '700', color: '#d97706' },
  famMeta: { fontSize: 13, color: '#9ca3af', marginTop: 3 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 32 },
  modalCard: { backgroundColor: '#fff', borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 19, fontWeight: '800', color: '#064e3b', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#f3f4f6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#111827', marginBottom: 18,
  },
  modalRow: { flexDirection: 'row', gap: 12 },
  modalCancel: {
    paddingHorizontal: 22, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  modalCancelText: { color: '#6b7280', fontWeight: '700', fontSize: 15 },
  modalCreate: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalCreateText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});