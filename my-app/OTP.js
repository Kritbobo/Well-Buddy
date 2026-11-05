import React, { useState, useRef } from 'react';
import { verifyOtp, sendOtp } from './otpService';
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

const OTP_LENGTH = 5;

export default function OTP({ navigation, route }) {
  const { email } = route.params; // ส่ง email มาจากหน้า Forgot
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

  const handleVerify = async () => {
    const otp = digits.join('');
    if (otp.length !== OTP_LENGTH) {
      Alert.alert('กรอกข้อมูลไม่ครบ', `กรุณากรอกรหัส OTP ให้ครบ ${OTP_LENGTH} หลัก`);
      return;
    }

    setLoading(true);
    const result = await verifyOtp(email, otp);
    setLoading(false);

    if (result.success) {
      navigation.replace('ResetPassword', { email, resetToken: result.resetToken });
    } else {
      Alert.alert('ยืนยันไม่สำเร็จ', result.message);
    }
  };

  const handleResend = async () => {
    setResending(true);
    const result = await sendOtp(email);
    setResending(false);

    if (result.success) {
      Alert.alert('ส่งรหัสใหม่แล้ว', 'กรุณาตรวจสอบอีเมลของคุณอีกครั้ง');
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } else {
      Alert.alert('ส่งรหัสไม่สำเร็จ', result.message);
    }
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
          <Text style={styles.title}>ยืนยัน OTP</Text>

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
            disabled={resending}
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
    marginBottom: 32,
  },
  fieldGroup: {
    marginBottom: 22,
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
    width: 52,
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