import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { auth } from './firebase';
import { updateProfile } from 'firebase/auth';
import { getUserProfile, saveSurveyData } from './surveyService';

export default function UsernameScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [photoURL, setPhotoURL] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // โหลดข้อมูลปัจจุบันทุกครั้งที่เข้าหน้านี้
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadProfile() {
        const uid = auth.currentUser?.uid;
        if (uid) {
          const profile = await getUserProfile(uid);
          if (isActive && profile) {
            setName(profile.name || '');
            setPhotoURL(profile.photoURL || null);
          }
        }
        if (isActive) setLoading(false);
      }

      loadProfile();
      return () => {
        isActive = false;
      };
    }, [])
  );

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('ต้องขออนุญาต', 'กรุณาอนุญาตให้เข้าถึงคลังรูปภาพก่อน');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      try {
        // บีบอัดรูปและแปลงเป็น Base64 แบบถาวร ไม่หลุดหลัง logout / สลับเครื่อง
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 320, height: 320 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        const permanentUri = `data:image/jpeg;base64,${manipResult.base64}`;
        setPhotoURL(permanentUri);
      } catch (err) {
        console.log('Image manipulation error:', err);
        setPhotoURL(result.assets[0].uri);
      }
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('กรอกข้อมูลไม่ครบ', 'กรุณากรอกชื่อผู้ใช้');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setSaving(true);
    const result = await saveSurveyData(uid, {
      name: name.trim(),
      photoURL,
    });

    // อัปเดตใน Firebase Auth Profile ด้วย
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: name.trim(),
          photoURL: photoURL || auth.currentUser.photoURL,
        });
      }
    } catch(e) {}

    setSaving(false);

    if (result.success) {
      Alert.alert('บันทึกสำเร็จ', 'อัปเดตข้อมูลผู้ใช้เรียบร้อยแล้ว', [
        { text: 'ตกลง', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('บันทึกไม่สำเร็จ', result.message);
    }
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

        <Text style={styles.title}>ชื่อผู้ใช้</Text>

        {loading ? (
          <ActivityIndicator color="#1A1A1A" style={{ marginTop: 40 }} />
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              {/* แถวรูปโปรไฟล์ + แก้ไขรูปภาพ */}
              <TouchableOpacity
                style={styles.avatarRow}
                onPress={handlePickImage}
              >
                <View style={styles.avatarWrapper}>
                  {photoURL ? (
                    <Image source={{ uri: photoURL }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={40} color="#FFFFFF" />
                    </View>
                  )}
                  <View style={styles.editBadge}>
                    <Ionicons name="camera" size={15} color="#FFFFFF" />
                  </View>
                </View>
                <Text style={styles.editPhotoText}>แก้ไขรูปภาพ</Text>
              </TouchableOpacity>

              {/* ชื่อผู้ใช้ */}
              <Text style={[styles.label, { marginTop: 24 }]}>ชื่อผู้ใช้</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="กรอกชื่อของคุณ"
                placeholderTextColor="#AAAAAA"
              />
            </View>

            {/* ปุ่มบันทึก */}
            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>บันทึกการเปลี่ยนแปลง</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
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
    borderRadius: 24,
    padding: 28,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarPlaceholder: {
    backgroundColor: '#6FB84C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  editPhotoText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
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