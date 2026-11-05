import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
// ต้องติดตั้งแพ็กเกจนี้ก่อนถ้ายังไม่มี: npx expo install expo-camera
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { detectFood } from './roboflowService';
import { lookupNutrition } from './nutritionTable';
import { auth } from './firebase';
import { addFoodLog } from './foodLogService';
import { useLang } from './LanguageContext';

const MEAL_TYPES = [
  { key: 'breakfast', label: 'เช้า' },
  { key: 'lunch', label: 'กลางวัน' },
  { key: 'dinner', label: 'เย็น' },
  { key: 'snack', label: 'ขนม' },
];

// คำแนะนำสั้น ๆ ใต้ผลลัพธ์ — ตอนนี้ใช้กฎง่าย ๆ จากสัดส่วนสารอาหารไปก่อน
// ในอนาคตค่อยเปลี่ยนไปใช้ข้อความที่ AI สร้างให้ตรงกับอาหารแต่ละจานจริง ๆ
function generateInsight({ protein = 0, carbs = 0, fat = 0 } = {}) {
  if (protein >= carbs && protein >= fat && protein >= 25) {
    return 'อาหารนี้มีโปรตีนสูง เหมาะสำหรับผู้ที่ต้องการเสริมสร้างกล้ามเนื้อ ควรรับประทานคู่กับผักหรือใยอาหารเพื่อสมดุลโภชนาการ';
  }
  if (fat >= protein && fat >= carbs && fat >= 25) {
    return 'อาหารนี้มีไขมันค่อนข้างสูง ควรรับประทานแต่พอดีและเลี่ยงการทานคู่กับอาหารไขมันสูงอื่น ๆ ในมื้อเดียวกัน';
  }
  if (carbs >= protein && carbs >= fat && carbs >= 40) {
    return 'อาหารนี้มีคาร์โบไฮเดรตสูง เหมาะเป็นแหล่งพลังงานหลัก ควรทานคู่กับโปรตีนและผักเพื่อความสมดุล';
  }
  return 'ลองทานคู่กับผักหรือผลไม้เพื่อเพิ่มใยอาหารและสารอาหารให้ครบถ้วนมากขึ้น';
}

// คำอธิบายปริมาณเบื้องต้น — ใช้ระหว่างรอ backend/AI ส่ง description มาจริง
function defaultDescription() {
  return 'ประมาณค่าพลังงานจากภาพที่ถ่าย ปริมาณและวิธีปรุงอาจส่งผลต่อความแม่นยำของค่าที่แสดง';
}

function formatDate(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d} / ${m} / ${y}`;
}

export default function ScanScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [flashOn, setFlashOn] = useState(false);

  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [mealType, setMealType] = useState('lunch');
  const [expiryDate, setExpiryDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // ซ่อนแถบ Tab bar ด้านล่าง เฉพาะตอนอยู่หน้ากล้องนี้
  // เพราะหน้าสแกนต้องการพื้นที่เต็มจอ ไม่อยากให้แถบ tab บังกล้อง/ปุ่มถ่ายรูป
  // หมายเหตุ: ScanScreen เป็นลูกโดยตรงของ Tab.Navigator (ดู MainTab.js) ดังนั้น
  // navigation ที่ได้รับตรงนี้คือ navigation ของ Tab.Navigator เองอยู่แล้ว
  // ไม่ต้องเรียก .getParent() — ถ้าเรียก จะกระโดดไปเจอ Stack.Navigator ชั้นนอกสุด
  // (ใน app.js) แทน ซึ่งไม่มีแนวคิดเรื่อง tab bar เลยไม่มีผลอะไร
  // เมื่อออกจากหน้านี้ (unmount) จะคืนค่าแถบ tab ให้กลับมาแสดงตามปกติ
  useEffect(() => {
    navigation.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      navigation.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  async function runAnalysis(uri, base64) {
    setImage(uri);
    setResult(null);
    setLoading(true);
    try {
      const detected = await detectFood(base64);
      console.log('Roboflow detected:', detected.name, detected.confidence);

      const nutrition = lookupNutrition(detected.name);
      if (!nutrition) {
        Alert.alert(
          t('ยังไม่มีข้อมูลโภชนาการ'),
          t('จำได้ว่าเป็น "{name}" แต่ยังไม่มีข้อมูลโภชนาการในตาราง', { name: detected.name })
        );
        setResult(null);
        setImage(null);
        return;
      }

      setResult(nutrition);
    } catch (e) {
      console.log('detectFood error:', e);
      Alert.alert(t('ผิดพลาด'), t('วิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้ง'));
      setResult(null);
      setImage(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleCapture() {
    if (!cameraRef.current || loading) return;
    if (scanMode !== 'food') {
      Alert.alert(t('เร็ว ๆ นี้'), t('โหมดนี้กำลังพัฒนา ตอนนี้รองรับการสแกน "อาหาร" ก่อน'));
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      await runAnalysis(photo.uri, photo.base64);
    } catch (e) {
      console.log('takePictureAsync error:', e);
      Alert.alert(t('ผิดพลาด'), t('ถ่ายภาพไม่สำเร็จ ลองใหม่อีกครั้ง'));
    }
  }

  async function handlePickFromGallery() {
    const res = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.5,
      allowsEditing: true,
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    await runAnalysis(asset.uri, asset.base64);
  }

  function resetScan() {
    setImage(null);
    setResult(null);
    setExpiryDate(null);
    setShowDatePicker(false);
  }

  async function handleSave() {
    if (saving || !result) return;
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert(t('ผิดพลาด'), t('กรุณาเข้าสู่ระบบก่อนบันทึกอาหาร'));
      return;
    }
    const mealLabel = MEAL_TYPES.find((m) => m.key === mealType)?.label || '';
    setSaving(true);
    try {
      let imageUri = image;
      if (image && typeof image === 'string' && !image.startsWith('data:image')) {
        try {
          const manipulated = await ImageManipulator.manipulateAsync(
            image,
            [{ resize: { width: 450 } }],
            { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
          );
          if (manipulated?.base64) {
            imageUri = `data:image/jpeg;base64,${manipulated.base64}`;
          }
        } catch (manipErr) {
          console.log('ImageManipulator error in handleSave:', manipErr.message);
        }
      }

      await addFoodLog(uid, {
        name: result.name,
        imageUri,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        mealType, // 'breakfast' | 'lunch' | 'dinner' | 'snack' — ผู้ใช้เลือกเองจากปุ่มด้านบน
      });
      Alert.alert(t('บันทึกสำเร็จ'), t('บันทึกมื้อ{meal}เรียบร้อยแล้ว', { meal: t(mealLabel) }));
      resetScan();
      // ไม่ได้สั่ง navigate ไปหน้า Home ให้อัตโนมัติ เพราะไม่แน่ใจชื่อ route ของแท็บ Home
      // ใน MainTab.js ของโปรเจกต์คุณ (ปกติจะยิงกลับผ่าน navigation.navigate('ชื่อแท็บ Home'))
      // แต่ไม่จำเป็นต้อง navigate ก็ได้ เพราะ HomeDashBoard subscribe ข้อมูลแบบเรียลไทม์อยู่แล้ว
      // พอผู้ใช้แตะแท็บ Home เอง ก็จะเห็นอาหารที่เพิ่งบันทึกอยู่ในมื้อที่เลือกทันที
    } catch (e) {
      console.log('addFoodLog error:', e.message);
      Alert.alert(t('ผิดพลาด'), t('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'));
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------
  // ยังไม่ได้รับอนุญาตใช้กล้อง
  // ---------------------------------------------------------------
  if (!permission) {
    return <View style={styles.cameraRoot} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.cameraRoot, styles.permissionWrap]}>
        <Ionicons name="camera-outline" size={48} color="#FFFFFF" />
        <Text style={styles.permissionText}>
          ต้องขออนุญาตใช้กล้องก่อนเริ่มสแกนอาหาร
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>{t('อนุญาตให้ใช้กล้อง')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------------------------------------------------------------
  // หน้าผลลัพธ์ (มีรูปแล้ว) — โหลดอยู่ / วิเคราะห์เสร็จแล้ว / error
  // ---------------------------------------------------------------
  if (image) {
    return (
      <View
        style={[
          styles.resultRoot,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <TouchableOpacity style={styles.backCircle} onPress={resetScan}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={styles.photoWrap}>
            <Image source={{ uri: image }} style={styles.photo} />
            <TouchableOpacity style={styles.closeOnPhoto} onPress={resetScan}>
              <Ionicons name="close" size={18} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#6FB84C" size="large" />
              <Text style={styles.loadingText}>{t('AI กำลังวิเคราะห์อาหาร...')}</Text>
            </View>
          )}

          {!loading && result && !result.error && (
            <>
              <View style={styles.nameRow}>
                <Text style={styles.foodName}>{result.name}</Text>
                <View style={styles.calorieBadge}>
                  <Ionicons name="flame" size={14} color="#C98A1F" />
                  <Text style={styles.calorieBadgeText}>{result.calories} cal</Text>
                </View>
              </View>
              <Text style={styles.portionText}>
                {result.description || t(defaultDescription())}
              </Text>

              <View style={styles.macroRow}>
                <View style={[styles.macroCard, styles.macroCardProtein]}>
                  <Text style={[styles.macroValue, styles.macroValueProtein]}>
                    {result.protein}g
                  </Text>
                  <Text style={styles.macroLabel}>โปรตีน</Text>
                </View>
                <View style={[styles.macroCard, styles.macroCardCarb]}>
                  <Text style={[styles.macroValue, styles.macroValueCarb]}>
                    {result.carbs}g
                  </Text>
                  <Text style={styles.macroLabel}>คาร์บ</Text>
                </View>
                <View style={[styles.macroCard, styles.macroCardFat]}>
                  <Text style={[styles.macroValue, styles.macroValueFat]}>
                    {result.fat}g
                  </Text>
                  <Text style={styles.macroLabel}>ไขมัน</Text>
                </View>
              </View>

              <View style={styles.insightBox}>
                <Ionicons name="sparkles" size={16} color="#3F7D2C" />
                <Text style={styles.insightText}>{t(generateInsight(result))}</Text>
              </View>

              <Text style={styles.sectionLabel}>{t('เลือกประเภทมื้อ')}</Text>
              <View style={styles.mealRow}>
                {MEAL_TYPES.map((m) => {
                  const isSelected = mealType === m.key;
                  return (
                    <TouchableOpacity
                      key={m.key}
                      style={[styles.mealPill, isSelected && styles.mealPillSelected]}
                      onPress={() => setMealType(m.key)}
                    >
                      <Text
                        style={[
                          styles.mealPillText,
                          isSelected && styles.mealPillTextSelected,
                        ]}
                      >
                        {t(m.label)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.expiryRow}
                onPress={() => setShowDatePicker(true)}
              >
                <View style={styles.expiryLeft}>
                  <Ionicons name="calendar-outline" size={18} color="#6FB84C" />
                  <View>
                    <Text style={styles.expiryLabel}>{t('วันหมดอายุ')}</Text>
                    <Text style={styles.expirySub}>{t('เพิ่มเมื่อบรรจุภัณฑ์ระบุ')}</Text>
                  </View>
                </View>
                <Text style={styles.expiryValue}>
                  {expiryDate ? formatDate(expiryDate) : 'xx / xx / xxxx'}
                </Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={expiryDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => {
                    if (Platform.OS === 'android') setShowDatePicker(false);
                    if (event.type !== 'dismissed' && date) setExpiryDate(date);
                  }}
                />
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.rescanButton} onPress={resetScan}>
                  <Ionicons name="refresh" size={16} color="#6FB84C" />
                  <Text style={styles.rescanText}>{t('สแกนใหม่')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>{t('บันทึก')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {!loading && result && result.error && (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle" size={36} color="#EF5350" />
              <Text style={styles.errText}>{result.error}</Text>
              <TouchableOpacity style={styles.rescanButton} onPress={resetScan}>
                <Ionicons name="refresh" size={16} color="#6FB84C" />
                <Text style={styles.rescanText}>{t('ลองใหม่')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ---------------------------------------------------------------
  // หน้ากล้อง (ยังไม่มีรูป)
  // ---------------------------------------------------------------
  return (
    <View style={styles.cameraRoot}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={flashOn} />

      {/* ไล่เฉดมืดบน-ล่าง ให้ตัวหนังสือ/ปุ่มอ่านง่ายขึ้นบนพื้นหลังกล้อง */}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* แถวบน: ปิด / โลโก้ / ช่วยเหลือ */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.iconCircle}
          onPress={() => navigation?.goBack?.()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.logoText}>WellBuddy</Text>
        <TouchableOpacity
          style={styles.iconCircle}
          onPress={() =>
            Alert.alert(
              t('วิธีใช้งาน'),
              t('จัดอาหารให้อยู่ในกรอบ แล้วกดปุ่มวงกลมด้านล่างเพื่อถ่ายและวิเคราะห์แคลอรี่')
            )
          }
          activeOpacity={0.7}
        >
          <Ionicons name="help" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* กรอบเล็งภาพ */}
      <View style={styles.viewfinderWrap} pointerEvents="none">
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </View>

      {/* แถบล่าง: แฟลช / ปุ่มชัตเตอร์ / อัลบั้มรูป */}
      <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 28 }]}>
        <TouchableOpacity
          style={styles.circleToolButton}
          onPress={() => setFlashOn((p) => !p)}
          activeOpacity={0.7}
        >
          <Ionicons name={flashOn ? 'flash' : 'flash-off'} size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shutterOuter}
          onPress={handleCapture}
          disabled={loading}
          activeOpacity={0.85}
        >
          <View style={styles.shutterInner} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.circleToolButton}
          onPress={handlePickFromGallery}
          activeOpacity={0.7}
        >
          <Ionicons name="images" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ---- กล้อง ----
  cameraRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: '#6FB84C',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 20,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
  },

  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  viewfinderWrap: {
    position: 'absolute',
    top: '16%',
    left: 40,
    right: 40,
    bottom: '22%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinder: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderColor: '#FFFFFF',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },

  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 10,
  },
  circleToolButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.5)',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  shutterInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#FFFFFF',
  },

  // ---- หน้าผลลัพธ์ ----
  resultRoot: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 20,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    height: 220,
    marginBottom: 16,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  closeOnPhoto: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 40,
  },
  loadingText: {
    color: '#6FB84C',
    fontSize: 14,
    fontWeight: '600',
  },

  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  foodName: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    lineHeight: 27,
  },
  calorieBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FBF0DA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  calorieBadgeText: {
    color: '#C98A1F',
    fontWeight: '700',
    fontSize: 13,
  },

  portionText: {
    fontSize: 13,
    color: '#8A8A8A',
    lineHeight: 20,
    marginBottom: 18,
  },

  macroRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  macroCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  macroCardProtein: { backgroundColor: '#EEE3F9' },
  macroCardCarb: { backgroundColor: '#FBF0DA' },
  macroCardFat: { backgroundColor: '#FBE4D8' },
  macroValue: { fontSize: 18, fontWeight: '800' },
  macroValueProtein: { color: '#7C4DBE' },
  macroValueCarb: { color: '#C98A1F' },
  macroValueFat: { color: '#D9702E' },
  macroLabel: { fontSize: 12, color: '#8A8A8A', marginTop: 2 },

  insightBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#EAF3DE',
    borderRadius: 16,
    padding: 14,
    marginBottom: 22,
    alignItems: 'flex-start',
  },
  insightText: {
    flex: 1,
    fontSize: 12.5,
    color: '#3F7D2C',
    lineHeight: 19,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  mealRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  mealPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
  },
  mealPillSelected: {
    backgroundColor: '#6FB84C',
  },
  mealPillText: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '600',
  },
  mealPillTextSelected: {
    color: '#FFFFFF',
  },

  expiryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#EEEEEE',
    marginBottom: 24,
  },
  expiryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expiryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  expirySub: {
    fontSize: 11,
    color: '#AAAAAA',
    marginTop: 2,
  },
  expiryValue: {
    fontSize: 13,
    color: '#AAAAAA',
    fontWeight: '500',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rescanButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#6FB84C',
    backgroundColor: '#FFFFFF',
  },
  rescanText: {
    color: '#6FB84C',
    fontWeight: '700',
    fontSize: 14,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#6FB84C',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },

  errBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 40,
  },
  errText: {
    color: '#EF5350',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
  },
});