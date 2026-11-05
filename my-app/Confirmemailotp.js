import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { verifyEmailChangeOtp, sendEmailChangeOtp, logoutUser } from './authservice';

// backend generateOtp() ใน index.js สร้างรหัส 5 หลัก (ใช้ฟังก์ชันเดียวกับ
// flow ลืมรหัสผ่าน) ต้องให้ตรงกัน ไม่งั้นผู้ใช้กรอกรหัสให้ครบตามที่ backend
// ส่งจริงไม่ได้เลย (หน้าจอเดิมเขียนผิดเป็น 6 หลัก)
const OTP_LENGTH = 5;

export default function ConfirmEmailOtp({ navigation, route }) {
  const { newEmail } = route.params || {};
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const insets = useSafeAreaInsets();
  const inputRefs = useRef([]);

  const handleChangeDigit = (text, index) => {
    // อนุญาตเฉพาะตัวเลข 1 หลัก
    const value = text.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // เปลี่ยนอีเมลเสร็จแล้ว — ออกจากระบบแล้วพากลับไปหน้า Home2 ให้ล็อกอินใหม่เสมอ
  // ไม่พึ่ง auth.currentUser.reload() อีกต่อไป เพราะบางครั้งหลัง backend เปลี่ยน
  // อีเมลผ่าน Admin SDK แล้ว client SDK ไม่ยอมอัปเดตอีเมล/token ให้ตรงกันจริงๆ
  // วิธีที่ชัวร์สุดคือบังคับล็อกอินใหม่ ระบบจะดึงข้อมูลล่าสุดมาแสดงถูกต้องแน่นอน
  const handleVerify = async () => {
    const otp = digits.join('');
    if (otp.length !== OTP_LENGTH) {
      Alert.alert('กรอกข้อมูลไม่ครบ', `กรุณากรอกรหัส OTP ให้ครบ ${OTP_LENGTH} หลัก`);
      return;
    }

    setLoading(true);
    await verifyEmailChangeOtp(newEmail, otp);
    await logoutUser();
    setLoading(false);

    navigation.reset({ index: 0, routes: [{ name: 'Home2' }] });
  };

  const handleResend = async () => {
    setResending(true);
    const result = await sendEmailChangeOtp(newEmail);
    setResending(false);

    if (!result.success) {
      Alert.alert('ส่งรหัสไม่สำเร็จ', result.message);
      return;
    }

    setDigits(Array(OTP_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
    Alert.alert('ส่งรหัสแล้ว', `เราส่งรหัส OTP ใหม่ไปที่ ${newEmail} แล้ว`);
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ปุ่มย้อนกลับ */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
          </TouchableOpacity>

          {/* หัวข้อ */}
          <Text style={styles.title}>ยืนยันอีเมลใหม่</Text>
          <Text style={styles.subtitle}>
            เราได้ส่งรหัส OTP {OTP_LENGTH} หลักไปที่{'\n'}
            <Text style={{ fontWeight: '700' }}>{newEmail}</Text>
          </Text>

          {/* ช่องกรอก OTP */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>รหัส OTP</Text>
            <View style={styles.otpRow}>
              {digits.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={styles.otpBox}
                  value={digit}
                  onChangeText={(text) => handleChangeDigit(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  editable={!loading}
                />
              ))}
            </View>
          </View>

          {/* ปุ่มยืนยัน */}
          <TouchableOpacity
            style={[styles.confirmButton, loading && { opacity: 0.7 }]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.confirmButtonText}>ยืนยัน</Text>
            )}
          </TouchableOpacity>

          {/* ส่งรหัสใหม่ */}
          <TouchableOpacity
            style={styles.resendContainer}
            onPress={handleResend}
            disabled={resending || loading}
          >
            <Text style={styles.resendText}>
              {resending ? 'กำลังส่งใหม่...' : 'ไม่ได้รับรหัส? ส่งอีกครั้ง'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#444444',
    marginBottom: 8,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  otpBox: {
    width: 48,
    height: 52,
    backgroundColor: '#EEF3F9',
    borderRadius: 14,
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  confirmButton: {
    backgroundColor: '#6FB84C',
    borderRadius: 26,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  resendText: {
    color: '#6FB84C',
    fontSize: 13,
    fontWeight: '600',
  },
});