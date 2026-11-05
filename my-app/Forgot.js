import React, { useState } from 'react';
import { sendOtp } from './otpService';
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

export default function Forgot({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const handleConfirm = async () => {
    if (!email.trim()) {
      Alert.alert('กรอกข้อมูลไม่ครบ', 'กรุณากรอกอีเมลของคุณ');
      return;
    }

    setLoading(true);
    const result = await sendOtp(email);
    setLoading(false);

    if (result.success) {
      navigation.navigate('OTP', { email: email.trim() });
    } else {
      Alert.alert('ส่งอีเมลไม่สำเร็จ', result.message);
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
          <Text style={styles.title}>ลืมรหัสผ่าน</Text>

          {/* ช่องกรอกอีเมล */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>อีเมลล์</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder=""
              placeholderTextColor="#A0A0A0"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* ปุ่มยืนยัน */}
          <TouchableOpacity
            style={[styles.confirmButton, loading && { opacity: 0.7 }]}
            onPress={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.confirmButtonText}>ยืนยัน</Text>
            )}
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
  input: {
    backgroundColor: '#EEF3F9',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 15,
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
});