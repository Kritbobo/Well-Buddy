import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from './firebase';
import { seedFoodLogs, clearSeededLogs } from './seedService';

const OPTIONS = [3, 7, 14, 30];

export default function SeedDataScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState(null);

  const uid = auth.currentUser?.uid;

  const run = async () => {
    if (!uid) return Alert.alert('ผิดพลาด', 'ยังไม่ได้เข้าสู่ระบบ');
    setBusy(true);
    setResult(null);
    setProgress('กำลังเริ่ม...');
    try {
      const r = await seedFoodLogs(uid, days, (done, total) => {
        setProgress(`กำลังสร้าง ${done}/${total} วัน`);
      });
      setResult(r);
      setProgress('');
    } catch (e) {
      Alert.alert('สร้างไม่สำเร็จ', e.message);
      setProgress('');
    }
    setBusy(false);
  };

  const clear = () => {
    Alert.alert(
      'ลบข้อมูลที่สร้างไว้',
      'ลบเฉพาะข้อมูลที่เจนมาเท่านั้น มื้อที่สแกนเองจะไม่โดนลบ',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบเลย',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const n = await clearSeededLogs(uid);
              setResult(null);
              Alert.alert('ลบแล้ว', `ลบไป ${n} รายการ`);
            } catch (e) {
              Alert.alert('ลบไม่สำเร็จ', e.message);
            }
            setBusy(false);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#EAF6E0', '#F5FBF0', '#ffffff']} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#3F7D2C" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>สร้างข้อมูลตัวอย่าง</Text>
          <Text style={styles.sub}>สำหรับทดสอบและนำเสนอ</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }}>
        <View style={styles.noteCard}>
          <Ionicons name="information-circle" size={18} color="#2563EB" />
          <Text style={styles.noteText}>
            สร้างมื้ออาหารเมนูไทยย้อนหลังพร้อมยอดน้ำดื่ม ลงบัญชีที่กำลังใช้งานอยู่
            {'\n'}ไม่ใส่รูปภาพ — เพิ่มเองทีหลังได้
            {'\n'}วันที่มีข้อมูลอยู่แล้วจะถูกข้าม ไม่ทับของเดิม
          </Text>
        </View>

        <Text style={styles.sectionTitle}>ย้อนหลังกี่วัน</Text>
        <View style={styles.pillRow}>
          {OPTIONS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.pill, days === d && styles.pillOn]}
              onPress={() => setDays(d)}
              disabled={busy}
            >
              <Text style={[styles.pillText, days === d && styles.pillTextOn]}>{d} วัน</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={run} disabled={busy} activeOpacity={0.85}>
          <LinearGradient colors={['#7FC97F', '#6FB84C']} style={styles.mainBtn}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.mainBtnText}>สร้างข้อมูล {days} วัน</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {progress ? <Text style={styles.progress}>{progress}</Text> : null}

        {result && (
          <View style={styles.resultCard}>
            <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
            <Text style={styles.resultText}>
              สร้างเสร็จ {result.logs} มื้อ
              {result.skipped > 0 ? `\nข้าม ${result.skipped} วันที่มีข้อมูลอยู่แล้ว` : ''}
              {'\n'}กดย้อนกลับแล้วเข้าหน้าแรกเพื่อดูผล
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.clearBtn} onPress={clear} disabled={busy}>
          <Ionicons name="trash-outline" size={16} color="#DC2626" />
          <Text style={styles.clearText}>ลบข้อมูลที่สร้างไว้ทั้งหมด</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>* ข้อมูลที่สแกนเองจะไม่ถูกลบ</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#064e3b' },
  sub: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  noteCard: {
    flexDirection: 'row', gap: 10, backgroundColor: '#EFF6FF',
    borderRadius: 16, padding: 14, marginBottom: 22,
  },
  noteText: { flex: 1, fontSize: 12, color: '#1E40AF', lineHeight: 19 },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#064e3b', marginBottom: 10 },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 22 },
  pill: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    borderRadius: 14, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#DCEBD0',
  },
  pillOn: { backgroundColor: '#6FB84C', borderColor: '#6FB84C' },
  pillText: { fontSize: 14, fontWeight: '700', color: '#4C7C3B' },
  pillTextOn: { color: '#fff' },

  mainBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    borderRadius: 18, paddingVertical: 16,
  },
  mainBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  progress: { textAlign: 'center', marginTop: 14, fontSize: 13, color: '#6b7280' },

  resultCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, marginTop: 18,
  },
  resultText: { flex: 1, fontSize: 13, color: '#166534', lineHeight: 20 },

  clearBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    marginTop: 30, paddingVertical: 14, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#FECACA', backgroundColor: '#fff',
  },
  clearText: { color: '#DC2626', fontWeight: '700', fontSize: 14 },
  hint: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 12 },
});