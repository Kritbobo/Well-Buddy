import React, { useEffect } from 'react';
import { AppGuideProvider, useAppGuide, useGuideTarget } from './AppGuide';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// หน้าจริง (มีอยู่แล้ว)
import ScanScreen from './ScanScreen';
import HomeDashBoard from './HomeDashBoard';
import ChatScreen from './ChatScreen';
import ProfileScreen from './Profile';
import FamilyScreen from './FamilyScreen';
import FamilyDetailScreen from './FamilyDetailScreen';
import MemberDetailScreen from './MemberDetailScreen';
import PantryScreen from './PantryScreen';
import InsightsScreen from './InsightsScreen';

// ---- หน้าเปล่าชั่วคราว ----
function Placeholder({ name }) {
  return (
    <View style={styles.center}>
      <Text style={styles.phText}>{name}</Text>
      <Text style={styles.phSub}>หน้านี้กำลังพัฒนา</Text>
    </View>
  );
}

const Tab = createBottomTabNavigator();

// จับคู่ไอคอน (focused = filled, ปกติ = outline)
const ICONS = {
  Home:    { on: 'home',           off: 'home-outline' },
  Pantry:  { on: 'restaurant',     off: 'restaurant-outline' },
  Scan:    { on: 'scan',           off: 'scan-outline' },
  Chat:    { on: 'chatbubble',     off: 'chatbubble-outline' },
  Profile: { on: 'person',         off: 'person-outline' },
};

function GuideTabButton({ name, children, ...props }) {
  const targetRef = useGuideTarget('tab-' + name);
  return <TouchableOpacity {...props} ref={targetRef} collapsable={false}>{children}</TouchableOpacity>;
}

// ==== custom tab bar (แคปซูลลอย) ====
function CustomTabBar({ state, navigation, descriptors }) {
  const insets = useSafeAreaInsets();
  const { setNavigation } = useAppGuide();
  useEffect(() => { setNavigation(navigation); }, [navigation, setNavigation]);
  // เช็ค options ของ "หน้าที่กำลังโฟกัสอยู่" — ถ้าหน้านั้นสั่ง
  // navigation.getParent()?.setOptions({ tabBarStyle: { display: 'none' } })
  // ไว้ (เช่น ScanScreen ตอนเปิดกล้องแบบเต็มจอ) ให้ไม่ render แคปซูลเลย
  const focusedRoute = state.routes[state.index];
  const focusedOptions = descriptors[focusedRoute.key]?.options;
  if (focusedOptions?.tabBarStyle?.display === 'none') {
    return null;
  }

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.capsule}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const icon = ICONS[route.name] || ICONS.Home;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <GuideTabButton
              name={route.name}
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={styles.item}
            >
              <View style={[styles.circle, isFocused && styles.circleActive]}>
                <Ionicons
                  name={isFocused ? icon.on : icon.off}
                  size={22}
                  color={isFocused ? '#059669' : '#6b7280'}
                />
              </View>
            </GuideTabButton>
          );
        })}
      </View>
    </View>
  );
}

// Stack ซ้อนในแท็บ Home — ทำให้แท็บล่างยังอยู่ตอนเข้าหน้าครอบครัว
const HomeStack = createNativeStackNavigator();
function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeDashBoard} />
      <HomeStack.Screen name="Family" component={FamilyScreen} />
      <HomeStack.Screen name="FamilyDetail" component={FamilyDetailScreen} />
      <HomeStack.Screen name="MemberDetail" component={MemberDetailScreen} />
      <HomeStack.Screen name="Insights" component={InsightsScreen} />
    </HomeStack.Navigator>
  );
}

export default function MainTabs() {
  return (
    <AppGuideProvider>
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeStackScreen} />
      <Tab.Screen name="Pantry" component={PantryScreen} />
      <Tab.Screen name="Scan" component={ScanScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
    </AppGuideProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  phText: { fontSize: 24, fontWeight: '800', color: '#059669' },
  phSub: { fontSize: 14, color: '#94a3b8', marginTop: 8 },

  // ตัวห่อ ดันแคปซูลลอยเหนือขอบล่าง
  wrap: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    paddingBottom: 24,
    backgroundColor: 'transparent',
  },
  // แคปซูลขาว เงาอ่อน
  capsule: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  item: { marginHorizontal: 4 },
  // วงกลมแต่ละไอคอน
  circle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  // วงกลมตอนเลือก (พื้นเขียวจางๆ)
  circleActive: {
    backgroundColor: '#d1fae5',
  },
});