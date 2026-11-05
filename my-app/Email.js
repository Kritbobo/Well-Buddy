import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { auth } from './firebase';
import { wakeBackend } from './authservice';

export default function EmailScreen({ navigation }) {
  // ปลุก backend ทันทีที่เข้าหน้านี้ ให้มันตื่นรอไว้ก่อนถึงเวลาต้องใช้จริง
  useEffect(() => {
    wakeBackend();
  }, []);

  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(auth.currentUser?.email || '');
  const [originalEmail, setOriginalEmail] = useState(auth.currentUser?.email || '');

  // รีเฟรชอีเมลทุกครั้งที่กลับมาที่หน้านี้ (เช่น กลับมาจากยืนยัน OTP เปลี่ยนอีเมล)
  // ไม่งั้นค่าที่ตั้งไว้ตอน mount ครั้งแรกจะค้าง ไม่อัปเดตตามอีเมลล่าสุด
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function refreshEmail() {
        try {
          await auth.currentUser?.reload();
        } catch (reloadError) {
          console.log('reload user ไม่สำเร็จ:', reloadError);
        }
        if (isActive) {
          const currentEmail = auth.currentUser?.email || '';
          setEmail(currentEmail);
          setOriginalEmail(currentEmail);
        }
      }

      refreshEmail();
      return () => {
        isActive = false;
      };
    }, [])
  );

  const handleSave = () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      Alert.alert('กรอกข้อมูลไม่ครบ', 'กรุณากรอกอีเมลของคุณ');
      return;
    }
    if (trimmedEmail === originalEmail) {
      Alert.alert('ไม่มีการเปลี่ยนแปลง', 'กรุณาแก้ไขอีเมลก่อนบันทึก');
      return;
    }

    // ไม่เปลี่ยนอีเมลตรงนี้ทั้งสิ้น — ส่งต่อไปหน้ายืนยันตัวตนก่อนเสมอ
    // หน้าถัดไปจะขอรหัสผ่านปัจจุบัน แล้วส่ง OTP ไปที่อีเมลใหม่ให้ยืนยันอีกที
    navigation.navigate('ConfirmPassword', {
      newEmail: trimmedEmail,
    });
  };

  return (
    <LinearGradient
      colors={['#A8D97F', '#D4E68C', '#F2E491']}
      style={[styles.container, { paddingTop: insets.top + 12 }]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ปุ่มย้อนกลับ */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>

        <Text style={styles.title}>อีเมลล์</Text>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.label}>อีเมล</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* ปุ่มบันทึก — พาไปหน้ายืนยันตัวตนก่อนเสมอ ไม่ได้เปลี่ยนอีเมลทันที */}
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>บันทึกการเปลี่ยนแปลง</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  label: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1A1A1A',
  },
  saveButton: {
    backgroundColor: '#6FB84C',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});