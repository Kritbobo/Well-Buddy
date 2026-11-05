import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function QueName({ navigation, route }) {
  const { uid, email } = route.params;
  const [name, setName] = useState('');
  const insets = useSafeAreaInsets();

  const handleNext = () => {
    if (!name.trim()) {
      Alert.alert('กรอกข้อมูลไม่ครบ', 'กรุณากรอกชื่อของคุณ');
      return;
    }
    navigation.navigate('QueGender', { uid, email, name: name.trim() });
  };

  const handleSkip = () => {
    // ข้ามแบบสอบถามทั้งชุด ไม่บันทึกข้อมูล — ครั้งหน้า login จะถามใหม่
    navigation.replace('HomeDashBoard');
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
          {/* แถวบน: ย้อนกลับ + ข้าม */}
          <View style={styles.topRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSkip}>
              <Text style={styles.skipText}>ข้าม</Text>
            </TouchableOpacity>
          </View>

          {/* หัวข้อ */}
          <Text style={styles.title}>
            คุณ<Text style={styles.titleGreen}>ชื่อ</Text>อะไร?
          </Text>
          <Text style={styles.subtitle}>
            เราจะใช้ข้อมูลนี้เพื่อแนะนำประเภทอาหาร{'\n'}ที่เหมาะสมยิ่งขึ้นให้กับคุณ
          </Text>

          {/* ช่องกรอกชื่อ */}
          <View style={styles.fieldWrapper}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder=""
              autoFocus
            />
          </View>
        </ScrollView>

        {/* ปุ่มถัดไป */}
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>ถัดไป</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: {
    color: '#888888',
    fontSize: 14,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 40,
  },
  titleGreen: {
    color: '#6FB84C',
  },
  subtitle: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 24,
  },
  fieldWrapper: {
    marginTop: 40,
  },
  input: {
    backgroundColor: '#EFF6E9',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 24,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  nextButton: {
    backgroundColor: '#6FB84C',
    borderRadius: 26,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});