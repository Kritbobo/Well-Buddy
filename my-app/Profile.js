import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { auth } from './firebase';
import { updateProfile } from 'firebase/auth';
import { logoutUser } from './authservice';
import { getUserProfile, saveSurveyData } from './surveyService';
import { useLang } from './LanguageContext';
import { useAppGuide } from './AppGuide';

// เปิดใช้ LayoutAnimation บน Android (iOS รองรับโดย default อยู่แล้ว)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
// หน้านี้พื้นหลังเป็น gradient 3 สี ผ้าคลุมเลยใช้ LinearGradient ชุดเดียวกัน ไม่ใช่สีเดียว
function Cover({ replayKey }) {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    anim.setValue(1); // รีเซ็ตกลับทึบก่อนเล่นใหม่ทุกครั้งที่เข้าหน้า
    Animated.timing(anim, {
      toValue: 0, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
  }, [replayKey]);

  return (
    <Animated.View pointerEvents="none" style={[styles.cover, { opacity: anim }]}>
      <LinearGradient
        colors={['#F2E491', '#D4E68C', '#A8D97F']}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const MENU_ITEMS = [
  { key: 'email', label: 'อีเมลล์', icon: 'mail-outline' },
  { key: 'username', label: 'ชื่อผู้ใช้', icon: 'person-outline' },
  { key: 'language', label: 'ภาษา', icon: 'swap-horizontal-outline' },
  { key: 'guide', label: 'คู่มือการใช้งาน', icon: 'help-circle-outline' },
  { key: 'terms', label: 'ข้อกำหนดและเงื่อนไข', icon: 'lock-closed-outline' },
];

// ตัวเลือกภาษาที่รองรับ — เพิ่ม/ลดได้ตรงนี้ที่เดียว
const LANGUAGE_OPTIONS = [
  { key: 'th', label: 'ไทย' },
  { key: 'en', label: 'EN' },
];

export default function ProfileScreen({ navigation }) {
  const { start: startGuide } = useAppGuide();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [photoURL, setPhotoURL] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const { lang, setLang, t } = useLang();
  const [languageExpanded, setLanguageExpanded] = useState(false);
  const chevronAnim = useRef(new Animated.Value(0)).current;
  const [replayKey, setReplayKey] = useState(0);

  // โหลดข้อมูลโปรไฟล์ใหม่ทุกครั้งที่กลับมาที่หน้านี้ (เช่น หลังแก้ชื่อ)
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadProfile() {
        // reload ก่อนเสมอ เผื่อ auth.currentUser.email ที่ SDK cache ไว้ยังเป็นค่าเก่า
        // (เช่น เพิ่งเปลี่ยนอีเมลมาจากหน้า ConfirmEmailOtp)
        try {
          await auth.currentUser?.reload();
        } catch (reloadError) {
          console.log('reload user ไม่สำเร็จ:', reloadError);
        }

        const uid = auth.currentUser?.uid;
        setEmail(auth.currentUser?.email || '');

        if (uid) {
          const profile = await getUserProfile(uid);
          if (isActive && profile?.name) {
            setName(profile.name);
          }
          if (isActive) {
            setPhotoURL(profile?.photoURL || null);
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

  // ---- แอนิเมชัน: เล่นใหม่ทุกครั้งที่เข้าหน้า (แยกจาก useFocusEffect ที่โหลดโปรไฟล์) ----
  useFocusEffect(
    useCallback(() => {
      setReplayKey((k) => k + 1); // การ์ดทุกใบรีเซ็ตแล้วเล่นใหม่ตอนเข้าหน้า
    }, [])
  );

  const handleLogout = () => {
    Alert.alert(t('ออกจากระบบ'), t('ยืนยันการออกจากระบบใช่ไหม?'), [
      { text: t('ยกเลิก'), style: 'cancel' },
      {
        text: t('ออกจากระบบ'),
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          const result = await logoutUser();
          setLoggingOut(false);
          if (result.success) {
            navigation.reset({ index: 0, routes: [{ name: 'Home1' }] });
          } else {
            Alert.alert(t('ผิดพลาด'), result.message);
          }
        },
      },
    ]);
  };

  // สลับเปิด/ปิด dropdown ภาษา พร้อม animation ให้ลูกศรหมุนและตัวเลือกค่อยๆ drop ลงมา
  const toggleLanguageDropdown = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(chevronAnim, {
      toValue: languageExpanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setLanguageExpanded((prev) => !prev);
  };

  const handleMenuPress = (key) => {
    if (key === 'email') navigation.navigate('Email');
    if (key === 'username') navigation.navigate('Username');
    if (key === 'language') toggleLanguageDropdown();
    if (key === 'guide') startGuide();
    if (key === 'terms') navigation.navigate('Condition');
  };

  const handleSelectLanguage = (key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(chevronAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setLang(key);
    setLanguageExpanded(false);
  };

  const handlePickAvatar = async () => {
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
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 320, height: 320 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        const permanentUri = `data:image/jpeg;base64,${manipResult.base64}`;
        setPhotoURL(permanentUri);

        const uid = auth.currentUser?.uid;
        if (uid) {
          await saveSurveyData(uid, { photoURL: permanentUri });
          try {
            if (auth.currentUser) {
              await updateProfile(auth.currentUser, { photoURL: permanentUri });
            }
          } catch(e) {}
        }
      } catch (err) {
        console.log('Image manipulation error:', err);
      }
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#F2E491', '#D4E68C', '#A8D97F']}
        style={[styles.container, { paddingTop: insets.top + 12 }]}
      >
        {/* ปุ่มย้อนกลับ */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <HeaderIn replayKey={replayKey}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
          </TouchableOpacity>
        </HeaderIn>

        {/* รูปโปรไฟล์ */}
        <Appear index={0} replayKey={replayKey}>
          <TouchableOpacity
            style={styles.avatarWrapper}
            activeOpacity={0.85}
            onPress={handlePickAvatar}
          >
            {photoURL ? (
              <Image
                source={{ uri: photoURL }}
                style={styles.avatarImage}
                onError={() => {
                  console.log('Photo failed to load, resetting fallback');
                  setPhotoURL(null);
                }}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={48} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
        </Appear>

        {/* ชื่อ + อีเมล */}
        <Appear index={1} replayKey={replayKey}>
          {loading ? (
            <ActivityIndicator color="#1A1A1A" style={{ marginTop: 16 }} />
          ) : (
            <>
              <Text style={styles.name}>{name || t('ผู้ใช้ WellBuddy')}</Text>
              <Text style={styles.email}>{email}</Text>
            </>
          )}
        </Appear>

        {/* เมนูรายการ */}
        <Appear index={2} replayKey={replayKey}>
          <View style={styles.menuList}>
            {MENU_ITEMS.map((item) => {
              if (item.key === 'language') {
                const selectedLabel =
                  LANGUAGE_OPTIONS.find((opt) => opt.key === lang)?.label || '';
                return (
                  <View key="language" style={styles.languageWrapper}>
                    <TouchableOpacity
                      style={styles.languageHeader}
                      onPress={toggleLanguageDropdown}
                    >
                      <View style={styles.menuLeft}>
                        <Ionicons name={item.icon} size={20} color="#1A1A1A" />
                        <Text style={styles.menuLabel}>{t(item.label)}</Text>
                      </View>
                      <View style={styles.languageHeaderRight}>
                        <Text style={styles.languageCurrentText}>{selectedLabel}</Text>
                        <Animated.View
                          style={{
                            transform: [
                              {
                                rotate: chevronAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['0deg', '90deg'],
                                }),
                              },
                            ],
                          }}
                        >
                          <Ionicons name="chevron-forward" size={18} color="#1A1A1A" />
                        </Animated.View>
                      </View>
                    </TouchableOpacity>

                    {languageExpanded && (
                      <View style={styles.languageOptions}>
                        {LANGUAGE_OPTIONS.map((opt) => {
                          const isSelected = lang === opt.key;
                          return (
                            <TouchableOpacity
                              key={opt.key}
                              style={[
                                styles.languageOption,
                                isSelected && styles.languageOptionSelected,
                              ]}
                              onPress={() => handleSelectLanguage(opt.key)}
                            >
                              <Text
                                style={[
                                  styles.languageOptionText,
                                  isSelected && styles.languageOptionTextSelected,
                                ]}
                              >
                                {opt.label}
                              </Text>
                              {isSelected && (
                                <Ionicons name="checkmark" size={16} color="#3F7D2C" />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={item.key}
                  style={styles.menuItem}
                  onPress={() => handleMenuPress(item.key)}
                >
                  <View style={styles.menuLeft}>
                    <Ionicons name={item.icon} size={20} color="#1A1A1A" />
                    <Text style={styles.menuLabel}>{t(item.label)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#1A1A1A" />
                </TouchableOpacity>
              );
            })}
          </View>
        </Appear>

        {/* ปุ่มออกจากระบบ */}
        <Appear index={3} replayKey={replayKey}>
          <TouchableOpacity
            style={[styles.logoutButton, loggingOut && { opacity: 0.7 }]}
            onPress={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
                <Text style={styles.logoutText}>{t('ออกจากระบบ')}</Text>
              </>
            )}
          </TouchableOpacity>
        </Appear>
        </ScrollView>
      </LinearGradient>

      <Cover replayKey={replayKey} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFillObject },
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
  avatarWrapper: {
    alignItems: 'center',
    marginTop: 24,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#6FB84C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 12,
  },
  email: {
    fontSize: 13,
    color: '#3D3D3D',
    textAlign: 'center',
    marginTop: 2,
  },
  menuList: {
    marginTop: 28,
    gap: 12,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },

  // ---- dropdown เปลี่ยนภาษา ----
  languageWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  languageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  languageHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  languageCurrentText: {
    fontSize: 13,
    color: '#8A8A8A',
    fontWeight: '500',
  },
  languageOptions: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 4,
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  languageOptionSelected: {
    backgroundColor: '#EAF3DE',
  },
  languageOptionText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  languageOptionTextSelected: {
    color: '#3F7D2C',
    fontWeight: '700',
  },

  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EF5350',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 16,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});