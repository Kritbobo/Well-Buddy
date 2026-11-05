import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
let DirectVideoPlayer;
try {
  DirectVideoPlayer = require('./DirectVideoPlayer').default;
} catch (e) {
  DirectVideoPlayer = null;
}
import { auth } from './firebase';
import { useLang } from './LanguageContext';
import { localizeAmount } from './appI18n';
import { addFoodLog, deleteFoodLog, suggestMealType, MEAL_LABELS, MEAL_ORDER } from './foodLogService';
import { getMenuById } from './menuService';
import { getIngredientPhoto } from './ingredientPhotoService';
import {
  subscribeFridgeItems,
  findMatchingFridgeItem,
  calculateItemDeduction,
  deductFridgeItemsBatch,
  addFridgeItem,
  updateFridgeItem,
} from './fridgeService';

const { width } = Dimensions.get('window');

function isDisplayableImage(val) {
  return typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:image'));
}

function getYoutubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  return match ? match[1] : null;
}

function isDirectVideoUrl(url) {
  return /\.(mp4|mov|m3u8|webm)(\?.*)?$/i.test(url || '');
}

// ปรับปริมาณวัตถุดิบตามจำนวนที่ เช่น "150 กรัม" x2 = "300 กรัม", "1/2 cup" x2 = "1 cup"
// ไม่ได้ขึ้นต้นด้วยตัวเลข (เช่น "ตามชอบ") หรือเป็นช่วง/เศษผสม ("1-2 ช้อน", "1 1/2 cup") คืนค่าเดิม
function scaleAmount(amount, scale) {
  const s = String(amount ?? '').trim();
  if (!s || scale === 1) return s;
  const m = s.match(/^(\d[\d,]*(?:\.\d+)?)(?:\s*\/\s*(\d+))?(\s*)(.*)$/);
  if (!m || /^[\d\-–~/]/.test(m[4])) return s;
  const num = parseFloat(m[1].replace(/,/g, ''));
  const value = m[2] ? num / parseFloat(m[2]) : num;
  if (!value) return s;
  const v = value * scale;
  const qty = v >= 10 ? Math.round(v) : v >= 1 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
  return `${qty}${m[3]}${m[4]}`;
}

// ปริมาณที่แสดงบนจอ: คูณตามจำนวนที่ แล้วแปลหน่วยเป็นอังกฤษเมื่อเลือก EN
// หน่วยที่ตารางแปลไม่รู้จัก ใช้ amountEn จากเว็บแอดมินแทน ไม่มีก็คงภาษาไทยไว้
function displayAmount(item, scale, lang) {
  const scaled = scaleAmount(item.amount, scale);
  if (lang !== 'en') return scaled;
  const en = localizeAmount(scaled, 'en');
  if (en !== scaled || !/[฀-๿]/.test(scaled)) return en;
  return item.amountEn ? scaleAmount(item.amountEn, scale) : scaled;
}

// ค่าโภชนาการของเมนูส่วนใหญ่เป็นข้อความ เช่น "~1,150", "~430 kcal", "~35–38"
// เอามาคูณตรง ๆ จะได้ NaN แล้วถูกบันทึกเป็น 0 — ดึงตัวเลขออกมาก่อน (ถ้าเป็นช่วงใช้ค่ากลาง)
function macroNumber(value) {
  if (typeof value === 'number') return value;
  const nums = String(value ?? '').replace(/,/g, '').match(/\d+(?:\.\d+)?/g);
  if (!nums) return 0;
  const vals = nums.slice(0, 2).map(Number);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// ข้อมูลเมนูจากเว็บแอดมินเก็บฉบับอังกฤษคู่ไว้ (nameEn, textEn ...) — ไม่มีก็ใช้ภาษาไทยเดิม
const pickEn = (lang, th, en) => (lang === 'en' && en ? en : th);

// ชื่อกลุ่มที่เว็บแอดมินตั้งให้อัตโนมัติ ("กลุ่ม 1") แปลได้ ชื่อที่แอดมินพิมพ์เองคงไว้ตามเดิม
function groupTitle(group, lang, t) {
  const m = /^กลุ่ม\s*(\d+)$/.exec(String(group.title || '').trim());
  if (m) return t('กลุ่ม {n}', { n: m[1] });
  return pickEn(lang, group.title, group.titleEn);
}

const DEFAULT_RECIPE = {
  name: 'Stuffed eggplants\nwith salad',
  subtitle: 'Classic Japanese recipe',
  difficulty: 'ทำง่าย',
  time: '40 min',
  kcal: 384,
  protein: 18,
  baseServings: 2,
  images: ['1', '2', '3', '4'],
  videoUrl: null,
  ingredientGroups: [
    {
      title: 'For the eggplant',
      items: [
        { id: 'i1', name: 'Eggplant', amount: '400g', status: 'add', kcal: 132, protein: 5 },
        { id: 'i2', name: 'Extra-virgin olive oil', amount: '1 tbsp', status: 'have', note: 'Expiring in 7 days', kcal: 119, protein: 0 },
      ],
    },
    {
      title: 'For the quinoa-nut crumble',
      items: [
        { id: 'i3', name: 'Quinoa', amount: '1/2 cup', status: 'add' },
        { id: 'i4', name: 'Extra-virgin olive oil', amount: '1 tbsp', status: 'add' },
        { id: 'i5', name: 'Walnuts', amount: '1 cup', status: 'add' },
        { id: 'i6', name: 'Mushrooms', amount: '150g', status: 'add' },
        { id: 'i7', name: 'Garlic clove', amount: '1 pcs', status: 'remove' },
        { id: 'i8', name: 'Tomato paste', amount: '1/2 tbsp', status: 'add' },
        { id: 'i9', name: 'Cumin', amount: '1/4 tsp', status: 'have' },
        { id: 'i10', name: 'Red pepper flakes', amount: '1 pinch', status: 'have' },
      ],
    },
    {
      title: 'For the mint yoghurt sauce',
      items: [
        { id: 'i11', name: 'Plain greek yogurt', amount: '1 pcs', status: 'remove' },
        { id: 'i12', name: 'Extra-virgin olive oil', amount: '1 tbsp', status: 'have' },
        { id: 'i13', name: 'Fresh mint leaves', amount: '1/2 cup', status: 'have' },
        { id: 'i14', name: 'Red pepper flakes', amount: '1 pinch', status: 'add' },
      ],
    },
  ],
  equipment: [
    { id: 'e1', icon: 'grid-outline', text: 'stove,knife,cutting board, pan\nkitchen spatula, spoon' },
    { id: 'e2', icon: 'reader-outline', text: 'stove,knife,cutting board, pan\nkitchen spatula, spoon' },
  ],
  manual: [
    { id: 'm1', text: 'Slice eggplant in half and score the flesh in a diamond cross-hatch pattern by making two or three long cuts, cutting at a steep angle, and then rotating the eggplant to make another set of similar cuts.', muted: false },
    { id: 'm2', text: 'Brush generously with olive oil, and season with salt and pepper.', muted: true },
    { id: 'm3', text: 'Arrange each half, cut side down, on the baking sheet and roast for about 30 minutes, or until tender.', muted: false },
  ],
};

function StatusToggle({ status, onPress }) {
  const isHave = status === 'have';

  return (
    <TouchableOpacity
      style={[
        styles.statusToggle,
        { backgroundColor: isHave ? '#F0F0F0' : '#6FB84C' },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons
        name={isHave ? 'checkmark' : 'add'}
        size={16}
        color={isHave ? '#9AA0A6' : '#FFFFFF'}
      />
    </TouchableOpacity>
  );
}

export default function RecipeDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { lang, t } = useLang();
  const menuId = route?.params?.menuId;

  const initialRecipe = { ...DEFAULT_RECIPE, ...(route?.params?.recipe || {}) };

  const [recipe, setRecipe] = useState(initialRecipe);
  const [activeImage, setActiveImage] = useState(0);
  const [servings, setServings] = useState(initialRecipe.baseServings || 2);
  const [groups, setGroups] = useState(initialRecipe.ingredientGroups || []);
  const [mealType, setMealType] = useState(suggestMealType());
  const [savingMenu, setSavingMenu] = useState(false);
  const [menuAdded, setMenuAdded] = useState(false);
  const [lastAddedLogId, setLastAddedLogId] = useState(null);
  const [lastDeductionsBackup, setLastDeductionsBackup] = useState([]);
  const [lastGroupsBackup, setLastGroupsBackup] = useState(null);
  const [undoingMenu, setUndoingMenu] = useState(false);

  // ข้อมูลวัตถุดิบในตู้เย็น & Modal ยืนยันวัตถุดิบก่อนเพิ่มเมนู
  const [fridgeItems, setFridgeItems] = useState([]);
  const [cookModalVisible, setCookModalVisible] = useState(false);
  const [deductionPlan, setDeductionPlan] = useState([]);

  // เลือกวัตถุดิบจากตู้เย็นแทน (Substitution)
  const [substituteModalVisible, setSubstituteModalVisible] = useState(false);
  const [substituteTargetIndex, setSubstituteTargetIndex] = useState(null);
  const [isCustomInputActive, setIsCustomInputActive] = useState(false);
  const [customSubstituteName, setCustomSubstituteName] = useState('');

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = subscribeFridgeItems(uid, (items) => {
      setFridgeItems(items);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!menuId) return;
    let cancelled = false;

    getMenuById(menuId)
      .then(async (doc) => {
        if (cancelled || !doc) return;
        const merged = { ...DEFAULT_RECIPE, ...doc };

        const groupsWithPhotos = await Promise.all(
          (merged.ingredientGroups || []).map(async (g, gi) => ({
            ...g,
            items: await Promise.all(
              (g.items || []).map(async (it, ii) => {
                const photo = await getIngredientPhoto(it.name);
                return {
                  id: it.id || `${gi}-${ii}`,
                  status: it.status === 'have' ? 'have' : 'add',
                  ...it,
                  image: photo || null,
                };
              })
            ),
          }))
        );

        setRecipe(merged);
        setGroups(groupsWithPhotos);
        setServings(merged.baseServings || 2);
      })
      .catch((e) => console.log('getMenuById error:', e.message));

    return () => {
      cancelled = true;
    };
  }, [menuId]);

  const totalIngredients = groups.reduce((sum, g) => sum + g.items.length, 0);
  // ตัวคูณปริมาณตามจำนวนที่ที่เลือก (สูตรตั้งไว้สำหรับ baseServings ที่)
  const servingScale = servings / (recipe.baseServings || 2);
  const recipeName = pickEn(lang, recipe.name, recipe.nameEn);

  const cycleStatus = (groupIndex, itemId) => {
    setGroups((prev) =>
      prev.map((group, gi) => {
        if (gi !== groupIndex) return group;
        return {
          ...group,
          items: group.items.map((item) =>
            item.id === itemId
              ? { ...item, status: item.status === 'have' ? 'add' : 'have' }
              : item
          ),
        };
      })
    );
  };

  // เรียกเปิด Modal คำนวณวัตถุดิบเมื่อกดปุ่ม "เพิ่มเมนู"
  const handleOpenAddMenuModal = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Alert.alert(t('กรุณาเข้าสู่ระบบ'), t('ต้องล็อกอินก่อนถึงจะเพิ่มเมนูได้'));
      return;
    }

    const baseServings = recipe.baseServings || 2;
    const scale = servings / baseServings;

    const plan = [];
    groups.forEach((group) => {
      (group.items || []).forEach((item) => {
        if (item.status === 'remove') return;
        const matched = findMatchingFridgeItem(item.name, fridgeItems);
        const userHasItManually = item.status === 'have';
        // ชื่อ/ปริมาณไว้โชว์ใน Modal เท่านั้น — การจับคู่ตู้เย็นและหักของยังใช้ชื่อ/ปริมาณต้นฉบับ
        const labels = {
          recipeItemLabel: pickEn(lang, item.name, item.nameEn),
          recipeAmountLabel: displayAmount(item, scale, lang),
        };

        if (matched) {
          const calc = calculateItemDeduction(item.amount, matched.amount, scale);
          plan.push({
            ...labels,
            id: matched.id,
            recipeItemName: item.name,
            recipeAmount: item.amount,
            fridgeItem: matched,
            action: calc.action,
            remainingStr: calc.remainingStr,
            selected: calc.action !== 'none',
            status: calc.action === 'update'
              ? 'sufficient'
              : calc.action === 'none'
                ? 'sufficient'
                : calc.fridgeBaseValue > 0
                  ? 'insufficient'
                  : 'sufficient',
          });
        } else if (userHasItManually) {
          plan.push({
            ...labels,
            id: `manual-${item.id}`,
            recipeItemName: item.name,
            recipeAmount: item.amount,
            fridgeItem: null,
            action: 'none',
            remainingStr: null,
            selected: true,
            status: 'manual_have',
          });
        } else {
          plan.push({
            ...labels,
            id: `missing-${item.id}-${Math.random()}`,
            recipeItemName: item.name,
            recipeAmount: item.amount,
            fridgeItem: null,
            action: 'none',
            remainingStr: null,
            selected: false,
            status: 'missing',
          });
        }
      });
    });

    setDeductionPlan(plan);
    setSubstituteTargetIndex(null);
    setCookModalVisible(true);
  };

  const toggleSelectItem = (index) => {
    setDeductionPlan((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSelectSubstitute = (index) => {
    setSubstituteTargetIndex(index);
    setIsCustomInputActive(false);
    setCustomSubstituteName('');
  };

  const applySubstitution = (selectedFridgeItem) => {
    if (substituteTargetIndex === null) return;

    const baseServings = recipe.baseServings || 2;
    const scale = servings / baseServings;
    const targetPlan = deductionPlan[substituteTargetIndex];

    const calc = calculateItemDeduction(targetPlan.recipeAmount, selectedFridgeItem.amount, scale);

    setDeductionPlan((prev) =>
      prev.map((item, i) => {
        if (i !== substituteTargetIndex) return item;
        return {
          ...item,
          fridgeItem: selectedFridgeItem,
          substitutedName: selectedFridgeItem.name,
          customSubstitute: false,
          action: calc.action,
          remainingStr: calc.remainingStr,
          selected: true,
          status:
            calc.action === 'update'
              ? 'sufficient'
              : calc.action === 'none'
                ? 'sufficient'
                : calc.fridgeBaseValue > 0
                  ? 'insufficient'
                  : 'sufficient',
        };
      })
    );

    setSubstituteTargetIndex(null);
    setIsCustomInputActive(false);
    setCustomSubstituteName('');
  };

  const applyCustomSubstitution = (customName) => {
    if (substituteTargetIndex === null) return;
    const targetPlan = deductionPlan[substituteTargetIndex];
    const rawName = (customName || '').trim();
    const finalName = rawName || targetPlan.recipeItemName;
    const isSameAsRecipe = finalName === targetPlan.recipeItemName;

    setDeductionPlan((prev) =>
      prev.map((item, i) => {
        if (i !== substituteTargetIndex) return item;
        return {
          ...item,
          fridgeItem: null,
          substitutedName: isSameAsRecipe ? null : finalName,
          customSubstitute: true,
          action: 'none',
          remainingStr: null,
          selected: true,
          status: 'custom_have',
        };
      })
    );

    setSubstituteTargetIndex(null);
    setCustomSubstituteName('');
    setIsCustomInputActive(false);
  };

  // ยืนยันเพิ่มเมนู: หักวัตถุดิบในตู้เย็น + เพิ่ม Food Log
  const handleConfirmAddMenu = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setSavingMenu(true);
    try {
      const selectedDeductions = deductionPlan
        .filter((p) => p.selected && p.fridgeItem && p.action !== 'none')
        .map((p) => ({
          itemId: p.fridgeItem.id,
          action: p.action,
          newAmount: p.remainingStr,
        }));

      // บันทึก backup ไว้กรณีผู้ใช้กดผิดหรือเผลอกด จะได้กู้คืนกลับมาได้
      setLastGroupsBackup(JSON.parse(JSON.stringify(groups)));

      const deductionBackups = [];
      for (const p of selectedDeductions) {
        const orig = fridgeItems.find((f) => f.id === p.itemId);
        if (orig) {
          deductionBackups.push({
            itemId: p.itemId,
            wasDeleted: p.action === 'delete',
            originalAmount: orig.amount,
            originalItem: {
              name: orig.name,
              amount: orig.amount,
              category: orig.category,
              expiryDate: orig.expiryDate,
              image: orig.image,
            },
          });
        }
      }

      if (selectedDeductions.length > 0) {
        await deductFridgeItemsBatch(uid, selectedDeductions);
      }

      const baseServings = recipe.baseServings || 2;
      const scale = servings / baseServings;

      // หารูปหน้าปกเมนูเพื่อส่งไปบันทึกใน Food Log
      const coverImage =
        (recipe.images || []).find(isDisplayableImage) ||
        (isDisplayableImage(recipe.image) ? recipe.image : null) ||
        (isDisplayableImage(recipe.imageUri) ? recipe.imageUri : null) ||
        null;

      const logDocRef = await addFoodLog(uid, {
        name: recipe.name.replace(/\n/g, ' '),
        imageUri: coverImage,
        calories: Math.round(macroNumber(recipe.kcal) * scale),
        protein: Math.round(macroNumber(recipe.protein) * scale),
        // เมนูจากแอดมินเก็บคาร์บไว้ในช่อง carb (บางเมนูอาจเป็น carbs) — ไม่มีค่าก็เป็น 0
        carbs: Math.round(macroNumber(recipe.carb || recipe.carbs) * scale),
        fat: Math.round(macroNumber(recipe.fat) * scale),
        mealType,
      });

      // อัปเดตสถานะวัตถุดิบในหน้าให้ติ๊กถูกว่าเพิ่มแล้ว (status: 'have') สำหรับรายการที่เลือกใน Modal
      const selectedRecipeNames = new Set(
        deductionPlan
          .filter((p) => p.selected)
          .map((p) => p.recipeItemName)
      );
      setGroups((prev) =>
        prev.map((group) => ({
          ...group,
          items: group.items.map((item) =>
            selectedRecipeNames.has(item.name) ? { ...item, status: 'have' } : item
          ),
        }))
      );

      setCookModalVisible(false);
      setMenuAdded(true);
      setLastAddedLogId(logDocRef?.id || null);
      setLastDeductionsBackup(deductionBackups);

      // ภาษาไทยยังใช้ชื่อมื้อเต็มแบบเดิม ภาษาอังกฤษใช้ชื่อมื้อที่แปลแล้ว
      const mealName = lang === 'en' ? t(MEAL_LABELS[mealType]) : MEAL_LABELS[mealType];
      Alert.alert(
        t('เพิ่มเมนูสำเร็จ!'),
        selectedDeductions.length > 0
          ? t('หักวัตถุดิบในตู้เย็น {n} รายการและบันทึกมื้อ{meal}เรียบร้อยแล้ว', { n: selectedDeductions.length, meal: mealName })
          : t('บันทึกมื้อ{meal}เรียบร้อยแล้ว', { meal: mealName })
      );
    } catch (e) {
      Alert.alert(t('เกิดข้อผิดพลาด'), e.message);
    } finally {
      setSavingMenu(false);
    }
  };

  // ยกเลิกรายการที่เพิ่งเพิ่ม (กรณีเผลอกด หรือกดผิด)
  const handleUndoAddMenu = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    Alert.alert(
      t('ยกเลิกรายการนี้?'),
      t('ต้องการยกเลิกมื้อ{meal} ({name}) ที่เพิ่งเพิ่มใช่หรือไม่?', {
        meal: lang === 'en' ? t(MEAL_LABELS[mealType]) : MEAL_LABELS[mealType],
        name: recipeName.replace(/\n/g, ' '),
      }),
      [
        { text: t('ไม่ยกเลิก'), style: 'cancel' },
        {
          text: t('ยกเลิกรายการนี้'),
          style: 'destructive',
          onPress: async () => {
            setUndoingMenu(true);
            try {
              // 1. ลบ food log ที่เพิ่งบันทึก
              if (lastAddedLogId) {
                await deleteFoodLog(uid, lastAddedLogId);
              }

              // 2. คืนค่าสต็อกวัตถุดิบในตู้เย็นที่ถูกหักไป (ถ้ามี)
              if (lastDeductionsBackup.length > 0) {
                await Promise.all(
                  lastDeductionsBackup.map((item) => {
                    if (item.wasDeleted) {
                      return addFridgeItem(uid, item.originalItem);
                    } else {
                      return updateFridgeItem(uid, item.itemId, { amount: item.originalAmount });
                    }
                  })
                );
              }

              // 3. คืนค่าสถานะวัตถุดิบกลับสู่ค่าก่อนเพิ่มเมนู
              if (lastGroupsBackup) {
                setGroups(lastGroupsBackup);
                setLastGroupsBackup(null);
              }

              setMenuAdded(false);
              setLastAddedLogId(null);
              setLastDeductionsBackup([]);

              Alert.alert(t('ยกเลิกสำเร็จ'), t('ยกเลิกการเพิ่มเมนูและคืนค่าวัตถุดิบเรียบร้อยแล้ว'));
            } catch (e) {
              Alert.alert(t('เกิดข้อผิดพลาดในการยกเลิก'), e.message);
            } finally {
              setUndoingMenu(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* รูปเมนู + ปุ่มด้านบน */}
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / width);
              setActiveImage(i);
            }}
          >
            {recipe.images.map((img, i) => (
              <View key={i} style={styles.imageSlide}>
                {isDisplayableImage(img) ? (
                  <View style={styles.imagePhotoWrap}>
                    <Image source={{ uri: img }} style={styles.imagePhoto} resizeMode="cover" />
                  </View>
                ) : (
                  <View style={styles.imageCircle}>
                    <Ionicons name="restaurant" size={48} color="#CCCCCC" />
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          <View style={[styles.topButtons, { top: insets.top + 12 }]}>
            <TouchableOpacity style={styles.roundButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={20} color="#6FB84C" />
            </TouchableOpacity>
          </View>

          <View style={styles.dotsRow}>
            {recipe.images.map((_, i) => (
              <View key={i} style={[styles.dot, i === activeImage && styles.dotActive]} />
            ))}
          </View>
        </View>

        <View style={styles.content}>
          {/* หัวเมนู */}
          <Text style={styles.recipeName}>{recipeName}</Text>
          <Text style={styles.recipeSubtitle}>{pickEn(lang, recipe.subtitle, recipe.subtitleEn)}</Text>

          {/* แถวข้อมูลย่อ */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <View style={styles.infoIconCircle}>
                <Ionicons name="restaurant-outline" size={18} color="#6FB84C" />
              </View>
              <Text style={styles.infoText}>{t(recipe.difficulty)}</Text>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoIconCircle}>
                <Ionicons name="time-outline" size={18} color="#6FB84C" />
              </View>
              <Text style={styles.infoText}>
                {lang === 'en' ? String(recipe.time || '').replace(/นาที/g, 'min') : recipe.time}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoIconCircle}>
                <Ionicons name="flame-outline" size={18} color="#6FB84C" />
              </View>
              <Text style={styles.infoText}>{recipe.kcal} kcal</Text>
            </View>
          </View>

          {/* หัวข้อวัตถุดิบ + จำนวนเสิร์ฟ */}
          <View style={styles.ingredientHeaderRow}>
            <View>
              <Text style={styles.ingredientHeaderTitle}>
                {t('วัตถุดิบ')} <Text style={{ color: '#6FB84C' }}>{totalIngredients}</Text>
              </Text>
              <Text style={styles.ingredientHeaderSub}>How many servings?</Text>
            </View>

            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => setServings((s) => Math.max(1, s - 1))}
              >
                <Ionicons name="remove" size={16} color="#1A1A1A" />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{servings}</Text>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => setServings((s) => s + 1)}
              >
                <Ionicons name="add" size={16} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
          </View>

          {/* กลุ่มวัตถุดิบ */}
          {groups.map((group, gi) => (
            <View key={group.title} style={styles.ingredientGroup}>
              <View style={styles.groupHeaderRow}>
                <Text style={styles.groupHeaderText}>{groupTitle(group, lang, t)}</Text>
                <Ionicons name="chevron-down" size={16} color="#6FB84C" />
              </View>

              {group.items.map((item) => (
                <View key={item.id} style={styles.ingredientRow}>
                  {isDisplayableImage(item.image) ? (
                    <Image source={{ uri: item.image }} style={styles.ingredientThumbPhoto} />
                  ) : (
                    <View style={styles.ingredientThumb}>
                      <Ionicons name="nutrition-outline" size={20} color="#BBBBBB" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ingredientName}>{pickEn(lang, item.name, item.nameEn)}</Text>
                    {(item.kcal || item.protein) && (
                      <Text style={styles.ingredientNutrition}>
                        {item.kcal ? `${item.kcal} kcal` : ''}
                        {item.kcal && item.protein ? ' · ' : ''}
                        {item.protein ? t('{n}g โปรตีน', { n: item.protein }) : ''}
                      </Text>
                    )}
                    {item.note && <Text style={styles.ingredientNote}>{item.note}</Text>}
                  </View>
                  <Text style={styles.ingredientAmount}>{displayAmount(item, servingScale, lang)}</Text>
                  <StatusToggle
                    status={item.status}
                    onPress={() => cycleStatus(gi, item.id)}
                  />
                </View>
              ))}
            </View>
          ))}

          {/* วิธีการทำ */}
          <Text style={styles.sectionTitleBig}>{t('วิธีการทำ')}</Text>

          {recipe.videoUrl && isDirectVideoUrl(recipe.videoUrl) && DirectVideoPlayer ? (
            <DirectVideoPlayer
              uri={recipe.videoUrl}
              style={styles.videoBox}
              contentFit="cover"
            />
          ) : recipe.videoUrl && getYoutubeId(recipe.videoUrl) ? (
            <TouchableOpacity
              style={styles.videoBox}
              activeOpacity={0.85}
              onPress={() => Linking.openURL(recipe.videoUrl)}
            >
              <Image
                source={{ uri: `https://img.youtube.com/vi/${getYoutubeId(recipe.videoUrl)}/hqdefault.jpg` }}
                style={styles.videoThumbImage}
                resizeMode="cover"
              />
              <View style={styles.playButton}>
                <Ionicons name="play" size={26} color="#1A1A1A" />
              </View>
            </TouchableOpacity>
          ) : recipe.videoUrl ? (
            <TouchableOpacity
              style={styles.videoBox}
              activeOpacity={0.85}
              onPress={() => Linking.openURL(recipe.videoUrl)}
            >
              <View style={styles.playButton}>
                <Ionicons name="play" size={26} color="#1A1A1A" />
              </View>
              <Text style={styles.videoPlaceholderText}>{t('แตะเพื่อเปิดวิดีโอ')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.videoBox}>
              <View style={styles.playButton}>
                <Ionicons name="play" size={26} color="#1A1A1A" />
              </View>
              <Text style={styles.videoPlaceholderText}>{t('ยังไม่มีวิดีโอสำหรับเมนูนี้')}</Text>
            </View>
          )}

          <View style={styles.equipmentBox}>
            {recipe.equipment.map((eq, i) => (
              <View
                key={eq.id}
                style={[styles.equipmentRow, i !== recipe.equipment.length - 1 && styles.equipmentDivider]}
              >
                <Ionicons name={eq.icon} size={20} color="#6FB84C" />
                <Text style={styles.equipmentText}>{pickEn(lang, eq.text, eq.textEn)}</Text>
              </View>
            ))}
          </View>

          {/* Manual */}
          <Text style={styles.sectionTitleBig}>Manual</Text>
          {recipe.manual.map((step) => (
            <View key={step.id} style={styles.manualRow}>
              <Text style={[styles.manualBullet, step.muted && styles.manualTextMuted]}>•</Text>
              <Text style={[styles.manualText, step.muted && styles.manualTextMuted]}>
                {pickEn(lang, step.text, step.textEn)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ปุ่มลอยด้านล่าง */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.mealChipRow}>
          {MEAL_ORDER.map((key) => {
            const active = key === mealType;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.mealChip, active && styles.mealChipActive]}
                onPress={() => setMealType(key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.mealChipText, active && styles.mealChipTextActive]}>
                  {t(MEAL_LABELS[key])}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.actionRow}>
          {menuAdded ? (
            <>
              <TouchableOpacity
                style={styles.undoButton}
                activeOpacity={0.8}
                onPress={handleUndoAddMenu}
                disabled={undoingMenu || savingMenu}
              >
                {undoingMenu ? (
                  <ActivityIndicator size="small" color="#E06A4C" />
                ) : (
                  <Text style={styles.undoButtonText}>{t('ยกเลิกที่เพิ่งเพิ่ม')}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.addMenuButton,
                  { flex: 1.5, alignItems: 'center', justifyContent: 'center' },
                ]}
                activeOpacity={0.9}
                onPress={handleOpenAddMenuModal}
                disabled={savingMenu || undoingMenu}
              >
                {savingMenu ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.addMenuButtonText}>{t('เพิ่มเมนูอีกครั้ง')}</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.addMenuButton, { flex: 1 }]}
              activeOpacity={0.9}
              onPress={handleOpenAddMenuModal}
              disabled={savingMenu}
            >
              {savingMenu ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.addMenuButtonText}>{t('เพิ่มเมนู')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Modal ยืนยันเพิ่มเมนู & เลือกวัตถุดิบใช้แทน */}
      <Modal
        visible={cookModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (isCustomInputActive) {
            setIsCustomInputActive(false);
            setCustomSubstituteName('');
          } else if (substituteTargetIndex !== null) {
            setSubstituteTargetIndex(null);
          } else {
            setCookModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />

            {substituteTargetIndex !== null ? (
              /* View 2: เลือกวัตถุดิบจากตู้เย็นมาแทน หรือ ใช้วัตถุดิบนอกตู้เย็น */
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => {
                      if (isCustomInputActive) {
                        setIsCustomInputActive(false);
                        setCustomSubstituteName('');
                      } else {
                        setSubstituteTargetIndex(null);
                      }
                    }}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>{t('เลือกวัตถุดิบมาแทน')}</Text>
                </View>
                <Text style={styles.modalSubtitle}>
                  {t('เลือกวัตถุดิบที่จะใช้แทน')}{' '}
                  <Text style={{ color: '#6FB84C', fontWeight: 'bold' }}>
                    {deductionPlan[substituteTargetIndex]?.recipeItemLabel}
                  </Text>
                </Text>

                <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                  {/* ปุ่ม / ฟอร์ม ใช้วัตถุดิบอื่นที่ไม่ได้เพิ่มในตู้เย็น */}
                  {!isCustomInputActive ? (
                    <TouchableOpacity
                      style={styles.customSubstituteCard}
                      activeOpacity={0.8}
                      onPress={() => setIsCustomInputActive(true)}
                    >
                      <View style={styles.customSubstituteIconWrap}>
                        <Ionicons name="add-circle" size={22} color="#6FB84C" />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.customSubstituteTitle}>
                          {t('ใช้วัตถุดิบอื่นที่ไม่ได้เพิ่มในตู้เย็น')}
                        </Text>
                        <Text style={styles.customSubstituteDesc}>
                          {t('ระบุวัตถุดิบที่จะใช้แทน หรือใช้วัตถุดิบเดิมที่มีอยู่นอกตู้เย็น')}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#6FB84C" />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.customInputBox}>
                      <Text style={styles.customInputHeader}>
                        {t('ระบุวัตถุดิบที่คุณจะใช้แทน "{name}"', { name: deductionPlan[substituteTargetIndex]?.recipeItemLabel })}
                      </Text>

                      {/* ทางเลือกลัด: มีวัตถุดิบเดิมอยู่แล้ว แต่นอกตู้เย็น */}
                      <TouchableOpacity
                        style={styles.quickUseOriginalBtn}
                        activeOpacity={0.7}
                        onPress={() =>
                          applyCustomSubstitution(deductionPlan[substituteTargetIndex]?.recipeItemName)
                        }
                      >
                        <Ionicons name="checkmark-circle" size={18} color="#6FB84C" />
                        <Text style={styles.quickUseOriginalText}>
                          {t('มี "{name}" อยู่แล้ว (ไม่ได้เพิ่มในตู้เย็น)', { name: deductionPlan[substituteTargetIndex]?.recipeItemLabel })}
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.customInputRow}>
                        <TextInput
                          style={styles.customTextInput}
                          placeholder={t('หรือพิมพ์ชื่อวัตถุดิบอื่น เช่น อกไก่, เต้าหู้...')}
                          placeholderTextColor="#999999"
                          value={customSubstituteName}
                          onChangeText={setCustomSubstituteName}
                          autoFocus
                        />
                        <TouchableOpacity
                          style={[
                            styles.customSubmitBtn,
                            !customSubstituteName.trim() && { opacity: 0.5 },
                          ]}
                          disabled={!customSubstituteName.trim()}
                          onPress={() => applyCustomSubstitution(customSubstituteName)}
                        >
                          <Text style={styles.customSubmitBtnText}>{t('ใช้แทน')}</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={styles.customCancelLink}
                        onPress={() => {
                          setIsCustomInputActive(false);
                          setCustomSubstituteName('');
                        }}
                      >
                        <Text style={styles.customCancelLinkText}>{t('ยกเลิกการพิมพ์')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* ส่วนรายการวัตถุดิบในตู้เย็น */}
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.fridgeSectionLabel}>
                      {fridgeItems.length > 0
                        ? t('เลือกจากในตู้เย็นของคุณ ({n} รายการ):', { n: fridgeItems.length })
                        : t('วัตถุดิบในตู้เย็น:')}
                    </Text>

                    {fridgeItems.length === 0 ? (
                      <View style={styles.emptyFridgeBox}>
                        <Ionicons name="snow-outline" size={26} color="#B0B0B0" />
                        <Text style={styles.emptyFridgeText}>
                          {t('ไม่มีวัตถุดิบในตู้เย็นของคุณ\nกดปุ่มด้านบนเพื่อใช้วัตถุดิบนอกตู้เย็นได้ทันที')}
                        </Text>
                      </View>
                    ) : (
                      fridgeItems.map((fItem) => (
                        <TouchableOpacity
                          key={fItem.id}
                          style={styles.modalItemRow}
                          activeOpacity={0.7}
                          onPress={() => applySubstitution(fItem)}
                        >
                          <Ionicons name={fItem.icon || 'nutrition-outline'} size={22} color="#6FB84C" />
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.modalItemName}>{fItem.name}</Text>
                            <Text style={[styles.modalItemSub, { color: '#8FBF7A' }]}>
                              {fItem.amount ? t('ปริมาณในตู้เย็น: {amount}', { amount: fItem.amount }) : t('ไม่ระบุปริมาณ')}
                              {fItem.expiryDate ? ` · ${t('หมดอายุ {date}', { date: fItem.expiryDate })}` : ''}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color="#CCCCCC" />
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={[styles.modalCancelButton, { marginTop: 14 }]}
                  activeOpacity={0.9}
                  onPress={() => {
                    setSubstituteTargetIndex(null);
                    setIsCustomInputActive(false);
                    setCustomSubstituteName('');
                  }}
                >
                  <Text style={styles.modalCancelText}>{t('กลับ')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* View 1: ยืนยันเพิ่มเมนู & รายการหักวัตถุดิบ */
              <>
                <Text style={styles.modalTitle}>{t('ยืนยันเพิ่มเมนู')}</Text>
                <Text style={styles.modalSubtitle}>
                  {t('เลือกวัตถุดิบที่จะหักออกจากตู้เย็นของคุณ')}
                </Text>

                <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                  {deductionPlan.map((plan, index) => {
                    const statusMeta = {
                      sufficient: { label: t('มีพอในตู้เย็น'), color: '#6FB84C' },
                      insufficient: { label: t('มีในตู้เย็นไม่พอ'), color: '#E0A83A' },
                      manual_have: { label: t('คุณระบุว่ามีแล้ว (ไม่พบในตู้เย็น)'), color: '#9AA0A6' },
                      missing: { label: t('ยังไม่มีในตู้เย็น'), color: '#E06A4C' },
                      custom_have: { label: t('มีวัตถุดิบนอกตู้เย็น (ไม้หักจากในตู้เย็น)'), color: '#6FB84C' },
                    }[plan.status] || { label: '', color: '#9AA0A6' };

                    return (
                      <TouchableOpacity
                        key={plan.id}
                        style={styles.modalItemRow}
                        activeOpacity={0.7}
                        onPress={() => toggleSelectItem(index)}
                      >
                        <Ionicons
                          name={plan.selected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={plan.selected ? '#6FB84C' : '#CCCCCC'}
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.modalItemName}>
                            {plan.recipeItemLabel || plan.recipeItemName}
                            {plan.substitutedName ? (
                              <Text style={{ fontSize: 12, color: '#6FB84C', fontWeight: 'normal' }}>
                                {' ' + t('(ใช้ {name} แทน)', { name: plan.substitutedName })}
                              </Text>
                            ) : plan.status === 'custom_have' ? (
                              <Text style={{ fontSize: 12, color: '#6FB84C', fontWeight: 'normal' }}>
                                {' ' + t('(มีอยู่นอกตู้เย็น)')}
                              </Text>
                            ) : null}
                          </Text>
                          <Text style={[styles.modalItemSub, { color: statusMeta.color }]}>
                            {statusMeta.label}
                            {plan.action === 'update' && plan.remainingStr
                              ? ` · ${t('เหลือ {amount}', { amount: plan.remainingStr })}`
                              : ''}
                            {plan.action === 'delete' && plan.fridgeItem ? ` · ${t('ใช้หมด')}` : ''}
                          </Text>
                        </View>
                        <Text style={styles.modalItemAmount}>{plan.recipeAmountLabel || plan.recipeAmount}</Text>

                        <TouchableOpacity
                          style={styles.substituteBtn}
                          activeOpacity={0.7}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleSelectSubstitute(index);
                          }}
                        >
                          <Ionicons name="swap-horizontal" size={14} color="#6FB84C" />
                          <Text style={styles.substituteBtnText}>
                            {plan.fridgeItem || plan.status === 'custom_have' ? t('เปลี่ยน') : t('ใช้แทน')}
                          </Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    activeOpacity={0.9}
                    onPress={() => setCookModalVisible(false)}
                    disabled={savingMenu}
                  >
                    <Text style={styles.modalCancelText}>{t('ยกเลิก')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalConfirmButton}
                    activeOpacity={0.9}
                    onPress={handleConfirmAddMenu}
                    disabled={savingMenu}
                  >
                    {savingMenu ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalConfirmText}>{t('ยืนยันเพิ่มเมนู')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },

  imageSlide: {
    width,
    height: width * 0.75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCircle: {
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: (width * 0.6) / 2,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePhotoWrap: {
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: (width * 0.6) / 2,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  imagePhoto: {
    width: '100%',
    height: '100%',
  },
  topButtons: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#6FB84C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 10,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
  },
  dotActive: {
    backgroundColor: '#6FB84C',
  },

  content: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  recipeName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A1A1A',
    lineHeight: 30,
  },
  recipeSubtitle: {
    fontSize: 14,
    color: '#8FBF7A',
    marginTop: 6,
    marginBottom: 20,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 24,
  },
  infoItem: {
    alignItems: 'center',
  },
  infoIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D9EFCB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
  },

  ingredientHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  ingredientHeaderTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  ingredientHeaderSub: {
    fontSize: 12,
    color: '#AAAAAA',
    marginTop: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 14,
  },
  stepperButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    minWidth: 16,
    textAlign: 'center',
  },

  ingredientGroup: {
    marginBottom: 10,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 6,
  },
  groupHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6FB84C',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ingredientThumb: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ingredientThumbPhoto: {
    width: 46,
    height: 46,
    borderRadius: 14,
    marginRight: 12,
    backgroundColor: '#F5F5F5',
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  ingredientNutrition: {
    fontSize: 11,
    color: '#8FBF7A',
    marginTop: 2,
    fontWeight: '600',
  },
  ingredientNote: {
    fontSize: 11,
    color: '#B0B0B0',
    marginTop: 2,
  },
  ingredientAmount: {
    fontSize: 13,
    color: '#999999',
    marginRight: 14,
  },
  statusToggle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionTitleBig: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginTop: 20,
    marginBottom: 16,
  },
  videoBox: {
    height: 190,
    borderRadius: 20,
    backgroundColor: '#E9E4D8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  videoThumbImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholderText: {
    position: 'absolute',
    bottom: 14,
    fontSize: 12,
    color: '#8A8272',
  },
  equipmentBox: {
    borderWidth: 1.5,
    borderColor: '#DCEBD0',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  equipmentDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  equipmentText: {
    fontSize: 13,
    color: '#555555',
    flex: 1,
    lineHeight: 18,
  },

  manualRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  manualBullet: {
    fontSize: 14,
    color: '#1A1A1A',
    marginRight: 8,
  },
  manualText: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 21,
  },
  manualTextMuted: {
    color: '#C7C7C7',
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
  },
  addMenuButton: {
    backgroundColor: '#6FB84C',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addMenuButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  undoButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#F5C6BA',
    backgroundColor: '#FDF6F4',
  },
  undoButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#E06A4C',
  },

  mealChipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  mealChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
  },
  mealChipActive: {
    backgroundColor: '#6FB84C',
  },
  mealChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999999',
  },
  mealChipTextActive: {
    color: '#FFFFFF',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#999999',
    marginTop: 4,
    marginBottom: 16,
  },
  modalList: {
    maxHeight: 340,
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  substituteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9EB',
    borderColor: '#DCEBD0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 6,
  },
  substituteBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6FB84C',
  },
  modalItemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  modalItemAmount: {
    fontSize: 12,
    color: '#999999',
    marginLeft: 8,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555555',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#6FB84C',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customSubstituteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F9F0',
    borderColor: '#BFE0AC',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  customSubstituteIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5F3DD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customSubstituteTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#2D661B',
  },
  customSubstituteDesc: {
    fontSize: 11,
    color: '#557A46',
    marginTop: 2,
  },
  customInputBox: {
    backgroundColor: '#F9FAF7',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#C7E2B5',
    marginBottom: 12,
  },
  customInputHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  quickUseOriginalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF5E3',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#CFE6C4',
    gap: 8,
  },
  quickUseOriginalText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#346B1E',
    flex: 1,
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  customTextInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1A1A1A',
  },
  customSubmitBtn: {
    backgroundColor: '#6FB84C',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customCancelLink: {
    alignSelf: 'center',
    marginTop: 10,
    padding: 4,
  },
  customCancelLinkText: {
    fontSize: 12,
    color: '#888888',
  },
  fridgeSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  emptyFridgeBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    gap: 8,
  },
  emptyFridgeText: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 18,
  },
});