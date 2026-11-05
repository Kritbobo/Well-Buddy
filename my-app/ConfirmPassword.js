import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reauthenticate, sendEmailChangeOtp, changePassword } from './authservice';

export default function ConfirmPassword({ navigation, route }) {
  // newEmail / newPassword จะมีค่าเฉพาะฟิลด์ที่ผู้ใช้แก้ไขจริงในหน้า Email
  const { newEmail, newPassword } = route.params || {};
  const insets = useSafeAreaInsets();

  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!currentPassword.trim()) {
      Alert.alert('กรอกข้อมูลไม่ครบ', 'กรุณากรอกรหัสผ่านปัจจุบันของคุณ');
      return;
    }

    setLoading(true);

    // 1) ยืนยันตัวตนก่อนเสมอ ไม่ว่าจะแก้อีเมลหรือรหัสผ่านก็ตาม
    const reauthResult = await reauthenticate(currentPassword);
    if (!reauthResult.success) {
      setLoading(false);
      Alert.alert('ยืนยันตัวตนไม่สำเร็จ', reauthResult.message);
      return;
    }

    // 2) เปลี่ยนรหัสผ่านก่อน (ถ้ามีการกรอกมาจากหน้าก่อน) เพราะไม่ต้องรอ OTP
    if (newPassword) {
      const passwordResult = await changePassword(newPassword);
      if (!passwordResult.success) {
        setLoading(false);
        Alert.alert('เปลี่ยนรหัสผ่านไม่สำเร็จ', passwordResult.message);
        return;
      }
    }

    // 3) ขอเปลี่ยนอีเมล (ถ้ามีการแก้ไขมาจากหน้าก่อน)
    //    ระบบใหม่: backend ของเราจะส่งรหัส OTP ไปที่อีเมลใหม่
    //    อีเมลจะยังไม่เปลี่ยนจนกว่าผู้ใช้จะกรอก OTP ถูกต้องในหน้าถัดไป
    if (newEmail) {
      const otpResult = await sendEmailChangeOtp(newEmail);
      setLoading(false);

      if (!otpResult.success) {
        Alert.alert('ส่งรหัสยืนยันไม่สำเร็จ', otpResult.message);
        return;
      }

      // ไปหน้ากรอก OTP ต่อ
      navigation.navigate('ConfirmEmailOtp', { newEmail });
      return;
    }

    // ไม่มีการเปลี่ยนอีเมล มีแค่เปลี่ยนรหัสผ่าน -> จบขั้นตอนได้เลย
    setLoading(false);
    Alert.alert('สำเร็จ', 'บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว', [
      {
        text: 'ตกลง',
        onPress: () => navigation.navigate('Profile'),
      },
    ]);
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
        {/* แถบหัวข้อบน: ปุ่มย้อนกลับ + ชื่อหน้า */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>ยืนยันรหัสผ่านของคุณ</Text>
        <Text style={styles.subtitle}>
          ขั้นตอนสุดท้าย: กรอกรหัสผ่านเพื่อทำการเปลี่ยนแปลงให้เสร็จสมบูรณ์
        </Text>

        <Text style={styles.label}>รหัสผ่าน</Text>
        <View style={styles.passwordWrapper}>
          <TextInput
            style={styles.passwordInput}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry={!showPassword}
            placeholderTextColor="#AAAAAA"
            autoFocus
          />
          <TouchableOpacity onPress={() => setShowPassword((p) => !p)}>
            <Ionicons
              name={showPassword ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color="#888888"
            />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={[styles.confirmButton, loading && { opacity: 0.7 }]}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmButtonText}>เสร็จสิ้น</Text>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 32,
  },
  subtitle: {
    fontSize: 13,
    color: '#3D3D3D',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 13,
    color: '#3D3D3D',
    marginTop: 32,
    marginBottom: 8,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 15,
    color: '#1A1A1A',
  },
  confirmButton: {
    backgroundColor: '#6FB84C',
    borderRadius: 26,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});