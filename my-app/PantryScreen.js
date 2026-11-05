import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Image,
  Platform,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import DateTimePicker from '@react-native-community/datetimepicker';
import { auth } from './firebase';
import { getUserProfile } from './surveyService';
import { getMealRecommendations } from './geminiService';
import { getMenusByCategory } from './menuService';
import { useLang } from './LanguageContext';
import {
  FRIDGE_CATEGORIES as FRIDGE_CATEGORIES_BASE,
  subscribeFridgeItems,
  addFridgeItem,
  deleteFridgeItem,
  updateFridgeItem,
} from './fridgeService';
import { scheduleExpiryReminders } from './notificationService';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = width * 0.62;
const CARD_SPACING = 16;
const SIDE_SPACING = (width - CARD_WIDTH) / 2;

const PROFILE_DEFAULTS = {
  weight: 53,
  bmi: 19.5,
  bmiLabel: 'น้ำหนักปกติ',
  note: 'รักษาสมดุล กินให้ครบห้าหมู่',
  proteinTarget: 64,
  calorieTarget: 2000,
};

const CATEGORIES = ['อาหาร', 'เครื่องดื่ม', 'ขนม'];

const FRIDGE_CATEGORY_LABELS = {
  All: 'ทั้งหมด',
  Vegetables: 'ผัก',
  Fruit: 'ผลไม้',
  Meat: 'เนื้อ',
  Drinks: 'น้ำ',
  Others: 'อื่นๆ',
  Expiry: 'วันหมดอายุ',
};

const FRIDGE_FILTER_TABS = [
  { key: 'All', label: 'ทั้งหมด', match: () => true },
  {
    key: 'VegFruit',
    label: 'ผัก/ผลไม้',
    match: (cat) => cat === 'Vegetables' || cat === 'Fruit',
  },
  { key: 'Meat', label: 'เนื้อ', match: (cat) => cat === 'Meat' },
  { key: 'Drinks', label: 'น้ำ', match: (cat) => cat === 'Drinks' },
  { key: 'Others', label: 'อื่นๆ', match: (cat) => cat === 'Others' },
  { key: 'Expiry', label: 'วันหมดอายุ', match: null },
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function formatDate(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = THAI_MONTHS_SHORT[date.getMonth()];
  const y = date.getFullYear();
  return `${d} / ${m} / ${y}`;
}

function formatExpiryDDMMYYYY(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}-${m}-${y}`;
}

function freshnessMeta(daysLeft) {
  if (daysLeft >= 6) return { color: '#2ECC71', pct: daysLeft >= 14 ? 100 : 75 };
  if (daysLeft >= 3) return { color: '#F5A623', pct: 45 };
  return { color: '#E74C3C', pct: 10 };
}

function FridgeListView({ items, onLongPressItem }) {
  return (
    <View>
      {items.map((item) => {
        const fresh = freshnessMeta(item.daysLeft);
        let statusText;
        if (item.daysLeft < 0) {
          statusText = 'หมดอายุแล้ว';
        } else if (item.daysLeft === 0) {
          statusText = 'หมดอายุวันนี้';
        } else {
          statusText = `${item.daysLeft} วันก่อนหมดอายุ`;
        }

        return (
          <TouchableOpacity
            key={item.id}
            style={styles.fridgeListCard}
            activeOpacity={0.8}
            onLongPress={() => onLongPressItem && onLongPressItem(item)}
          >
            <View style={styles.fridgeListLeft}>
              <View style={styles.fridgeListImageWrap}>
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.fridgeImagePhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name={item.icon || 'restaurant-outline'} size={44} color="#BBBBBB" />
                )}

                {!!item.amount && (
                  <View style={styles.fridgeListAmountBadge}>
                    <Text style={styles.fridgeListAmountText} numberOfLines={1}>
                      {item.amount}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.fridgeListNameText} numberOfLines={1}>
                {item.name}
              </Text>
            </View>

            <View style={styles.fridgeListInfo}>
              {!!item.expiryDate && (
                <Text style={styles.fridgeListExpiryDate} numberOfLines={1}>
                  หมดอายุ {formatExpiryDDMMYYYY(item.expiryDate)}
                </Text>
              )}
              <Text style={[styles.fridgeListDaysText, { color: fresh.color }]} numberOfLines={1}>
                {statusText}
              </Text>
              <View style={styles.fridgeListProgressTrack}>
                <View
                  style={[
                    styles.fridgeListProgressFill,
                    { width: `${fresh.pct}%`, backgroundColor: fresh.color },
                  ]}
                />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function FridgeGridView({ items, onLongPressItem }) {
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }

  return (
    <View>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.fridgeGVRow}>
          {row.map((item) => {
            const fresh = freshnessMeta(item.daysLeft);
            let statusText;
            if (item.daysLeft < 0) {
              statusText = 'หมดอายุแล้ว';
            } else if (item.daysLeft === 0) {
              statusText = 'หมดอายุวันนี้';
            } else {
              statusText = `${item.daysLeft} วันก่อนหมดอายุ`;
            }
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.fridgeGVCol}
                activeOpacity={0.8}
                onLongPress={() => onLongPressItem && onLongPressItem(item)}
              >
                <View style={styles.fridgeGVCard}>
                  {/* กรอบรูปภาพ พร้อมแสดง Badge จำนวนที่มุมขวาบนในรูปเสมอ */}
                  <View style={styles.fridgeGVImageWrap}>
                    {item.image ? (
                      <Image
                        source={{ uri: item.image }}
                        style={styles.fridgeImagePhoto}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name={item.icon || 'restaurant-outline'} size={40} color="#BBBBBB" />
                    )}

                    {!!item.amount && (
                      <View style={styles.fridgeGVBadge}>
                        <Text style={styles.fridgeGVBadgeText} numberOfLines={1}>
                          {item.amount}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.fridgeGVProgressTrack}>
                    <View
                      style={[
                        styles.fridgeGVProgressFill,
                        { width: `${fresh.pct}%`, backgroundColor: fresh.color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.fridgeGVDaysLeft, { color: fresh.color }]} numberOfLines={1}>
                    {statusText}
                  </Text>
                </View>
                <Text style={styles.fridgeGVItemName} numberOfLines={1}>{item.name}</Text>
                {!!item.expiryDate && (
                  <Text style={styles.fridgeGVItemDate} numberOfLines={1}>
                    หมดอายุ {formatExpiryDDMMYYYY(item.expiryDate)}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
          {row.length === 1 && <View style={styles.fridgeGVCol} />}
        </View>
      ))}
    </View>
  );
}

function FoodCarousel({ items, onPressItem, lang }) {
  const scrollX = useRef(new Animated.Value(0)).current;

  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={CARD_WIDTH + CARD_SPACING}
      contentContainerStyle={{ paddingHorizontal: SIDE_SPACING }}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: true }
      )}
      scrollEventThrottle={16}
    >
      {items.map((item, i) => {
        const inputRange = [
          (i - 1) * (CARD_WIDTH + CARD_SPACING),
          i * (CARD_WIDTH + CARD_SPACING),
          (i + 1) * (CARD_WIDTH + CARD_SPACING),
        ];
        const scale = scrollX.interpolate({
          inputRange,
          outputRange: [0.88, 1, 0.88],
          extrapolate: 'clamp',
        });
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.5, 1, 0.5],
          extrapolate: 'clamp',
        });

        const displayName = lang === 'en' && item.nameEn ? item.nameEn : item.name;
        const displaySubtitle = lang === 'en' && item.subtitleEn ? item.subtitleEn : item.subtitle;

        return (
          <Animated.View
            key={item.id}
            style={[
              styles.card,
              {
                width: CARD_WIDTH,
                marginRight: i === items.length - 1 ? 0 : CARD_SPACING,
                transform: [{ scale }],
                opacity,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              style={{ alignItems: 'center' }}
              onPress={() => onPressItem && onPressItem(item)}
            >
              <View style={styles.plateShadowWrap}>
                <View style={styles.plate}>
                  {item.images && item.images.length > 0 ? (
                    <Image
                      source={{ uri: item.images[0] }}
                      style={styles.plateImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name={item.icon || 'restaurant-outline'} size={40} color="#BBBBBB" />
                  )}
                </View>
              </View>
              <Text style={styles.foodName} numberOfLines={2}>
                {displayName}
              </Text>
              <Text style={styles.foodSubtitle}>{displaySubtitle}</Text>

              <View style={styles.macroRow}>
                <Text style={styles.macroText}>{item.kcal} kcal</Text>
                <View style={styles.macroDot} />
                <Text style={styles.macroText}>
                  {item.protein}g {lang === 'en' ? 'protein' : 'โปรตีน'}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </Animated.ScrollView>
  );
}

export default function PantryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { lang, t } = useLang();
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [view, setView] = useState('recipes');
  const [fridgeCategory, setFridgeCategory] = useState(FRIDGE_FILTER_TABS[0].key);
  const [fridgeViewMode, setFridgeViewMode] = useState('list');
  const [expirySortAsc, setExpirySortAsc] = useState(true);

  const [fridgeItems, setFridgeItems] = useState([]);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsubscribe = subscribeFridgeItems(uid, (items) => {
      setFridgeItems(items);
      // ทุกครั้งที่รายการของในตู้เย็นอัปเดต -> ตรวจสอบและตั้งแจ้งเตือนของใกล้หมดอายุ
      // (ภายใน 2 วัน) ใหม่ ให้ตรงกับข้อมูลล่าสุด
      scheduleExpiryReminders(items, { thresholdDays: 2 });
    });
    return unsubscribe;
  }, []);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState(null);
  const [newExpiryDate, setNewExpiryDate] = useState(null);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [newImage, setNewImage] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingFridgeItem, setSavingFridgeItem] = useState(false);

  const resetAddForm = () => {
    setNewName('');
    setNewAmount('');
    setNewCategory(null);
    setNewExpiryDate(null);
    setShowExpiryPicker(false);
    setNewImage(null);
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('ต้องอนุญาตกล้อง', 'กรุณาอนุญาตการเข้าถึงกล้องในตั้งค่าเครื่อง');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (res.canceled) return;
    await processAndSetImage(res.assets[0].uri);
  };

  const handlePickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });
    if (res.canceled) return;
    await processAndSetImage(res.assets[0].uri);
  };

  const processAndSetImage = async (localUri) => {
    setUploadingPhoto(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: 500 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      const dataUri = `data:image/jpeg;base64,${manipulated.base64}`;
      if (dataUri.length > 700000) {
        Alert.alert('รูปใหญ่เกินไป', 'กรุณาเลือกรูปอื่นหรือถ่ายใหม่ในมุมที่มีรายละเอียดน้อยกว่านี้');
        return;
      }
      setNewImage(dataUri);
    } catch (e) {
      Alert.alert('ประมวลผลรูปไม่สำเร็จ', e.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAddFridgeItem = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert('กรุณาเข้าสู่ระบบ');
      return;
    }
    if (!newName.trim()) {
      Alert.alert('กรอกไม่ครบ', 'กรุณาใส่ชื่อวัตถุดิบ');
      return;
    }
    if (!newCategory) {
      Alert.alert('เลือกไม่ครบ', 'กรุณาเลือกหมวดหมู่ของวัตถุดิบ');
      return;
    }
    setSavingFridgeItem(true);
    try {
      const expiryDate = newExpiryDate ? newExpiryDate.toISOString().slice(0, 10) : null;
      await addFridgeItem(uid, {
        name: newName.trim(),
        amount: newAmount.trim(),
        category: newCategory,
        expiryDate,
        image: newImage,
      });
      setAddModalVisible(false);
      resetAddForm();
    } catch (e) {
      Alert.alert('เพิ่มไม่สำเร็จ', e.message);
    } finally {
      setSavingFridgeItem(false);
    }
  };

  const handleLongPressFridgeItem = (item) => {
    const uid = auth.currentUser?.uid;
    const buttons = [{ text: 'ยกเลิก', style: 'cancel' }];

    if (item.image) {
      buttons.push({
        text: 'ลบรูปภาพ',
        onPress: async () => {
          try {
            await updateFridgeItem(uid, item.id, { image: null });
          } catch (e) {
            Alert.alert('ลบรูปไม่สำเร็จ', e.message);
          }
        },
      });
    }

    buttons.push({
      text: 'ลบวัตถุดิบนี้ทั้งหมด',
      style: 'destructive',
      onPress: async () => {
        try {
          await deleteFridgeItem(uid, item.id);
        } catch (e) {
          Alert.alert('ลบไม่สำเร็จ', e.message);
        }
      },
    });

    Alert.alert(item.name, 'เลือกการดำเนินการ', buttons);
  };

  const [profile, setProfile] = useState(null);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (uid) getUserProfile(uid).then(setProfile);
  }, []);

  const displayProfile = {
    weight: profile?.weight ?? PROFILE_DEFAULTS.weight,
    bmi: profile?.bmi ?? PROFILE_DEFAULTS.bmi,
    bmiLabel: profile?.bmiLabel ?? PROFILE_DEFAULTS.bmiLabel,
    note: profile?.note ?? PROFILE_DEFAULTS.note,
    proteinTarget: profile?.proteinTarget ?? PROFILE_DEFAULTS.proteinTarget,
    calorieTarget: profile?.calories ?? PROFILE_DEFAULTS.calorieTarget,
  };

  const [recommended, setRecommended] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRecommendations() {
      setLoadingRecs(true);
      try {
        const allMenus = await getMenusByCategory(selectedCategory);
        const menus = allMenus.filter((m) => !m.isHidden);
        if (cancelled) return;

        if (menus.length === 0) {
          setRecommended([]);
          return;
        }

        const ranked = await getMealRecommendations(profile, menus);
        if (!cancelled) setRecommended(ranked.length > 0 ? ranked : menus);
      } catch (e) {
        console.log('load recommendations error:', e.message);
        if (!cancelled) setRecommended([]);
      } finally {
        if (!cancelled) setLoadingRecs(false);
      }
    }

    loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [selectedCategory, profile]);

  const items = recommended;
  const filteredFridgeItems = (() => {
    if (fridgeCategory === 'All') return fridgeItems;
    if (fridgeCategory === 'Expiry') {
      return [...fridgeItems].sort((a, b) => {
        if (a.daysLeft == null) return 1;
        if (b.daysLeft == null) return -1;
        return expirySortAsc ? a.daysLeft - b.daysLeft : b.daysLeft - a.daysLeft;
      });
    }
    const tab = FRIDGE_FILTER_TABS.find((t) => t.key === fridgeCategory);
    if (!tab || !tab.match) return fridgeItems;
    return fridgeItems.filter((it) => tab.match(it.category));
  })();

  const handlePressItem = (item) => {
    navigation.navigate('RecipeDetail', { menuId: item.id, recipe: item });
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 130,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }} />
          {view === 'fridge' && (
            <TouchableOpacity
              style={[styles.headerButton, { marginRight: 10 }]}
              onPress={() => setAddModalVisible(true)}
            >
              <Ionicons name="add" size={22} color="#4A4A4A" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setView((v) => (v === 'recipes' ? 'fridge' : 'recipes'))}
          >
            <Ionicons
              name={view === 'recipes' ? 'snow-outline' : 'restaurant-outline'}
              size={20}
              color="#1A1A1A"
            />
          </TouchableOpacity>
        </View>

        {view === 'recipes' ? (
          <>
            {/* การ์ดสรุปน้ำหนัก / เป้าแคลอรี่ */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryLeft}>
                <View style={styles.summaryIcon}>
                  <Ionicons name="flame" size={18} color="#1A1A1A" />
                </View>
                <View style={styles.summaryTextWrap}>
                  <Text style={styles.summaryTitle}>
                    น้ำหนัก {displayProfile.weight} kg · BMI {displayProfile.bmi}
                  </Text>
                  <Text style={styles.summarySub}>{displayProfile.bmiLabel}</Text>
                  <Text style={styles.summarySub}>{displayProfile.note}</Text>
                  <Text style={styles.summarySub}>
                    เป้าโปรตีน {displayProfile.proteinTarget}g/วัน
                  </Text>
                </View>
              </View>

              <View style={styles.summaryRight}>
                <Text style={styles.summaryRightLabel}>เป้าแคลอรี่/วัน</Text>
                <Text style={styles.summaryRightValue}>{displayProfile.calorieTarget}</Text>
                <Text style={styles.summaryRightUnit}>แคล</Text>
              </View>
            </View>

            {/* แท็บหมวดหมู่ */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabScroll}
              contentContainerStyle={styles.tabRow}
            >
              {CATEGORIES.map((cat) => {
                const active = cat === selectedCategory;
                const catLabel = lang === 'en' ? (cat === 'อาหาร' ? 'Food' : cat === 'เครื่องดื่ม' ? 'Beverages' : cat) : cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={styles.tabItem}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>
                      {catLabel}
                    </Text>
                    {active && <View style={styles.tabUnderline} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* การ์ดเมนูแนะนำ (carousel) */}
            <View style={{ marginTop: 24 }}>
              <View style={styles.aiLabelRow}>
                <Ionicons name="sparkles" size={14} color="#6FB84C" />
              </View>

              {loadingRecs ? (
                <View style={styles.recLoadingBox}>
                  <ActivityIndicator color="#6FB84C" />
                  <Text style={styles.recLoadingText}>กำลังคิดเมนูให้คุณ...</Text>
                </View>
              ) : items.length === 0 ? (
                <View style={styles.emptyMenuBox}>
                  <Ionicons name="fast-food-outline" size={22} color="#BBBBBB" />
                  <Text style={styles.emptyMenuText}>
                    ยังไม่มีเมนูในหมวด "{selectedCategory}" ใน Firestore{'\n'}
                    เพิ่มเมนูผ่าน Firebase Console (collection "menus") ก่อนนะครับ
                  </Text>
                </View>
              ) : (
                <FoodCarousel items={items} onPressItem={handlePressItem} lang={lang} />
              )}
            </View>
          </>
        ) : (
          <>
            {/* หัวข้อวัตถุดิบในตู้เย็น */}
            <View style={styles.fridgeHeaderRow}>
              <Text style={styles.fridgeTitle}>วัตถุดิบ</Text>
              <View style={styles.fridgeHeaderRight}>
                <Text style={styles.fridgeCount}>{fridgeItems.length} items</Text>
                <View style={styles.viewModeToggle}>
                  <TouchableOpacity
                    style={[styles.viewModeBtn, fridgeViewMode === 'list' && styles.viewModeBtnActive]}
                    onPress={() => setFridgeViewMode('list')}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="reorder-four-outline"
                      size={16}
                      color={fridgeViewMode === 'list' ? '#FFFFFF' : '#9AA3C4'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.viewModeBtn, fridgeViewMode === 'grid' && styles.viewModeBtnActive]}
                    onPress={() => setFridgeViewMode('grid')}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="grid-outline"
                      size={15}
                      color={fridgeViewMode === 'grid' ? '#FFFFFF' : '#9AA3C4'}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* แท็บหมวดหมู่ตู้เย็น */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabScroll}
              contentContainerStyle={styles.fridgeChipRow}
            >
              {FRIDGE_FILTER_TABS.map((tab) => {
                const active = tab.key === fridgeCategory;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.fridgeChip, active && styles.fridgeChipActive]}
                    onPress={() => setFridgeCategory(tab.key)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.fridgeChipText,
                        active && styles.fridgeChipTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* ตัวสลับทิศทางการเรียง */}
            {fridgeCategory === 'Expiry' && (
              <TouchableOpacity
                style={styles.sortToggleRow}
                onPress={() => setExpirySortAsc((prev) => !prev)}
                activeOpacity={0.7}
              >
                <Ionicons name="swap-vertical" size={16} color="#6FB84C" />
                <Text style={styles.sortToggleText}>
                  {expirySortAsc ? 'วันหมดอายุ: น้อยไปมาก' : 'วันหมดอายุ: มากไปน้อย'}
                </Text>
              </TouchableOpacity>
            )}

            {/* กริดวัตถุดิบ */}
            <View style={{ marginTop: 20 }}>
              {filteredFridgeItems.length === 0 ? (
                <View style={styles.emptyMenuBox}>
                  <Ionicons name="snow-outline" size={22} color="#BBBBBB" />
                  <Text style={styles.emptyMenuText}>
                    ยังไม่มีวัตถุดิบในตู้เย็นเลย{'\n'}กด "+" มุมขวาบนเพื่อเพิ่มรายการแรก
                  </Text>
                </View>
              ) : fridgeViewMode === 'list' ? (
                <FridgeListView items={filteredFridgeItems} onLongPressItem={handleLongPressFridgeItem} />
              ) : (
                <FridgeGridView items={filteredFridgeItems} onLongPressItem={handleLongPressFridgeItem} />
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal เพิ่มวัตถุดิบเข้าตู้เย็น */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setAddModalVisible(false)}
          />
          <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 16) + 10, height: '50%', maxHeight: '92%' }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>เพิ่มวัตถุดิบ/วันหมดอายุ</Text>
              <TouchableOpacity
                style={{ padding: 4 }}
                onPress={() => setAddModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              <Text style={styles.modalLabel}>รูปวัตถุดิบ</Text>
              <View style={styles.photoRow}>
                {newImage ? (
                  <View style={styles.photoPreviewWrap}>
                    <Image source={{ uri: newImage }} style={styles.photoPreview} />
                    <TouchableOpacity style={styles.photoRemoveBadge} onPress={() => setNewImage(null)}>
                      <Ionicons name="close" size={12} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ) : uploadingPhoto ? (
                  <View style={styles.photoPreviewWrap}>
                    <ActivityIndicator color="#6FB84C" />
                  </View>
                ) : (
                  <>
                    <Pressable
                      style={({ pressed }) => [
                        styles.photoPickButton,
                        pressed ? styles.photoPickButtonPrimary : styles.photoPickButtonSecondary,
                      ]}
                      onPress={handleTakePhoto}
                    >
                      {({ pressed }) => (
                        <>
                          <View style={styles.photoPickIconWrap}>
                            <Ionicons name="camera-outline" size={16} color={pressed ? '#4A90D9' : '#9AA3AA'} />
                          </View>
                          <Text style={pressed ? styles.photoPickText : styles.photoPickTextSecondary}>
                            ถ่ายรูป
                          </Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.photoPickButton,
                        pressed ? styles.photoPickButtonPrimary : styles.photoPickButtonSecondary,
                      ]}
                      onPress={handlePickPhoto}
                    >
                      {({ pressed }) => (
                        <>
                          <View style={styles.photoPickIconWrap}>
                            <Ionicons name="image-outline" size={16} color={pressed ? '#4A90D9' : '#9AA3AA'} />
                          </View>
                          <Text style={pressed ? styles.photoPickText : styles.photoPickTextSecondary}>
                            เลือกจากคลัง
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </>
                )}
              </View>

              <Text style={styles.modalLabel}>ชื่อวัตถุดิบ</Text>
              <TextInput
                style={styles.modalInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="เช่น Sweet Potatoes, อกไก่"
                placeholderTextColor="#B0B0B0"
              />

              <Text style={styles.modalLabel}>
                จำนวน <Text style={styles.modalOptionalText}>*ไม่บังคับใส่</Text>
              </Text>
              <TextInput
                style={styles.modalInput}
                value={newAmount}
                onChangeText={setNewAmount}
                placeholder="เช่น 600g หรือ 12 pcs"
                placeholderTextColor="#B0B0B0"
              />

              <Text style={[styles.modalLabel, { marginTop: 14 }]}>หมวดหมู่</Text>
              <View style={styles.modalChipRow}>
                {FRIDGE_CATEGORIES_BASE.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.modalChip, newCategory === cat && styles.modalChipActive]}
                    onPress={() => setNewCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.modalChipText,
                        newCategory === cat && styles.modalChipTextActive,
                      ]}
                    >
                      {FRIDGE_CATEGORY_LABELS[cat] || cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.expiryRow, { marginTop: 16 }]}
                onPress={() => setShowExpiryPicker(!showExpiryPicker)}
                activeOpacity={0.8}
              >
                <View style={styles.expiryLeft}>
                  <View style={styles.expiryIconWrap}>
                    <Ionicons name="calendar-outline" size={16} color="#4A90D9" />
                  </View>
                  <View>
                    <Text style={styles.expiryLabel}>วันหมดอายุ</Text>
                    <Text style={styles.expirySub}>แตะเพื่อเลือกวันที่</Text>
                  </View>
                </View>
                <Text style={[styles.expiryValue, newExpiryDate && { color: '#6FB84C', fontWeight: '700' }]}>
                  {newExpiryDate ? formatDate(newExpiryDate) : 'xx / xx / xxxx'}
                </Text>
              </TouchableOpacity>

              {showExpiryPicker && Platform.OS === 'ios' && (
                <View style={styles.iosDatePickerCard}>
                  <View style={styles.iosDatePickerHeader}>
                    <Text style={styles.iosDatePickerHeaderText}>
                      {formatDate(newExpiryDate || new Date())}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#6FB84C" />
                  </View>
                  <DateTimePicker
                    value={newExpiryDate || new Date()}
                    mode="date"
                    minimumDate={new Date()}
                    display="spinner"
                    locale="th-TH"
                    themeVariant="light"
                    textColor="#1A1A1A"
                    onChange={(event, date) => {
                      if (date) setNewExpiryDate(date);
                    }}
                  />
                  <TouchableOpacity
                    style={styles.iosDatePickerDoneButton}
                    onPress={() => setShowExpiryPicker(false)}
                  >
                    <Text style={styles.iosDatePickerDoneText}>เสร็จสิ้น</Text>
                  </TouchableOpacity>
                </View>
              )}

              {showExpiryPicker && Platform.OS !== 'ios' && (
                <DateTimePicker
                  value={newExpiryDate || new Date()}
                  mode="date"
                  minimumDate={new Date()}
                  display="default"
                  onChange={(event, date) => {
                    setShowExpiryPicker(false);
                    if (event.type !== 'dismissed' && date) setNewExpiryDate(date);
                  }}
                />
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalSaveButton, savingFridgeItem && { opacity: 0.7 }]}
              onPress={handleAddFridgeItem}
              disabled={savingFridgeItem}
            >
              {savingFridgeItem ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSaveButtonText}>เพิ่มเข้าตู้เย็น</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const GREEN = '#8FD16B';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: GREEN,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
  },
  summaryLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  summarySub: {
    fontSize: 13,
    color: '#3D3D3D',
    marginBottom: 2,
  },
  summaryRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  summaryRightLabel: {
    fontSize: 12,
    color: '#3D3D3D',
    fontWeight: '600',
  },
  summaryRightValue: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
    lineHeight: 46,
  },
  summaryRightUnit: {
    fontSize: 12,
    color: '#3D3D3D',
    alignSelf: 'flex-end',
  },

  tabScroll: {
    flexGrow: 0,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 26,
  },
  tabItem: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  tabText: {
    fontSize: 16,
    color: '#AAAAAA',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#4C9A2A',
  },
  tabUnderline: {
    marginTop: 8,
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: '#6FB84C',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    alignItems: 'center',
    paddingTop: 46,
    paddingBottom: 34,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  plateShadowWrap: {
    marginTop: -40,
    marginBottom: 14,
    borderRadius: 75,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  plate: {
    width: 170,
    height:170,
    borderRadius: 70,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  plateImage: {
    width: '100%',
    height: '100%',
    borderRadius: 75,
  },
  foodName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  foodSubtitle: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 16,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroText: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  macroDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CCCCCC',
    marginHorizontal: 8,
  },

  aiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 44,
  },
  aiLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6FB84C',
  },
  recLoadingBox: {
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  recLoadingText: {
    fontSize: 13,
    color: '#999999',
  },
  emptyMenuBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 60,
    paddingHorizontal: 30,
  },
  emptyMenuText: {
    fontSize: 13,
    color: '#AAAAAA',
    textAlign: 'center',
    lineHeight: 20,
  },

  // ---- ตู้เย็น ----
  fridgeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  fridgeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  fridgeCount: {
    fontSize: 16,
    color: '#9AA3C4',
    fontWeight: '600',
  },
  fridgeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F0F1F6',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  viewModeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewModeBtnActive: {
    backgroundColor: '#6FB84C',
  },
  fridgeChipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fridgeChip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: '#F2F3F7',
  },
  fridgeChipActive: {
    backgroundColor: '#6FB84C',
  },
  fridgeChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9AA3C4',
  },
  fridgeChipTextActive: {
    color: '#1A1A1A',
  },
  sortToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#EAF6E4',
  },
  sortToggleText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#3F7D2C',
  },

  fridgeListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F5FA',
    borderRadius: 20,
    padding: 12,
    marginBottom: 14,
  },
  fridgeGVRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  fridgeGVCol: {
    flex: 1,
    marginRight: 14,
  },
  fridgeGVCard: {
    backgroundColor: '#F3F5FA',
    borderRadius: 22,
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  fridgeGVBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 1,
  },
  fridgeGVBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fridgeGVImageWrap: {
    width: '100%',
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E8EAF2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  fridgeGVProgressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E5EE',
    overflow: 'hidden',
    marginBottom: 8,
  },
  fridgeGVProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  fridgeGVDaysLeft: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  fridgeGVItemName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 3,
  },
  fridgeGVItemDate: {
    fontSize: 12,
    color: '#B7BEDA',
    textAlign: 'center',
  },

  fridgeListLeft: {
    alignItems: 'center',
  },
  fridgeListImageWrap: {
    width: 120,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E8EAF2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fridgeListAmountBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 1,
  },
  fridgeListAmountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fridgeListNameText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginTop: 8,
    maxWidth: 120,
    textAlign: 'center',
  },
  fridgeListInfo: {
    flex: 1,
    marginLeft: 16,
    paddingRight: 6,
  },
  fridgeListExpiryDate: {
    fontSize: 14,
    color: '#9AA3C4',
    fontWeight: '600',
    marginBottom: 10,
  },
  fridgeListDaysText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  fridgeListProgressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E5EE',
    overflow: 'hidden',
  },
  fridgeListProgressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // ---- Modal เพิ่มวัตถุดิบ ----
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  modalLabel: {
    fontSize: 12,
    color: '#777777',
    marginBottom: 6,
    marginTop: 12,
  },
  modalOptionalText: {
    color: '#EF5350',
    fontWeight: '700',
  },
  modalInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1A1A1A',
  },
  modalChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
  },
  modalChipActive: {
    backgroundColor: '#6FB84C',
  },
  modalChipText: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '600',
  },
  modalChipTextActive: {
    color: '#FFFFFF',
  },
  modalSaveButton: {
    backgroundColor: '#6FB84C',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 22,
  },
  modalSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  expiryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EAF6E4',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#DCEBD0',
  },
  expiryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expiryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expiryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  expirySub: {
    fontSize: 11,
    color: '#8FA98A',
    marginTop: 2,
  },
  expiryValue: {
    fontSize: 13,
    color: '#AAAAAA',
    fontWeight: '500',
  },

  iosDatePickerCard: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    overflow: 'hidden',
    paddingBottom: 8,
  },
  iosDatePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  iosDatePickerHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  iosDatePickerDoneButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iosDatePickerDoneText: {
    color: '#6FB84C',
    fontSize: 15,
    fontWeight: '700',
  },

  photoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoPickButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  photoPickButtonPrimary: {
    backgroundColor: '#EAF6E4',
  },
  photoPickButtonSecondary: {
    backgroundColor: '#F2F2F2',
  },
  photoPickIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPickText: {
    fontSize: 12,
    color: '#4A4A4A',
    fontWeight: '600',
  },
  photoPickTextSecondary: {
    fontSize: 12,
    color: '#9AA3AA',
    fontWeight: '600',
  },
  photoPreviewWrap: {
    width: 90,
    height: 90,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreview: {
    width: 90,
    height: 90,
    borderRadius: 14,
  },
  photoRemoveBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E74C3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fridgeImagePhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
});