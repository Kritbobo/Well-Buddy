import React, { useEffect, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LogBox, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { registerForNotificationsAsync } from './notificationService';
import { initUserPresence } from './userPresenceService';
import { LanguageProvider } from './LanguageContext';

import Home1 from './Home1';
import Home2 from './Home2';
import Register from './Register';
import Login from './Login';
import MainTabs from './MainTab';
import Forgot from './Forgot';
import OTP from './OTP';
import ResetPassword from './ResetPassword';
import QueName from './QueName';
import QueGender from './QueGender';
import QueGoal from './QueGoal';
import QueBirth from './QueBirth';
import QueBMI from './QueBMI';
import QueActivity from './QueActivity';
import Email from './Email';
import ConfirmPassword from './ConfirmPassword';
import ConfirmEmailOtp from './Confirmemailotp';
import Username from './Username';
import Condition from './Condition';
import FamilyScreen from './FamilyScreen';
import FamilyDetailScreen from './FamilyDetailScreen';
import MemberDetailScreen from './MemberDetailScreen';
import RecipeDetailScreen from './RecipeDetailScreen';
import AdminDashboard from './AdminDashboard';
import SeedDataScreen from './SeedDataScreen';
import NotificationScreen from './NotificationScreen';

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
]);


const Stack = createNativeStackNavigator();

export const navigationRef = createNavigationContainerRef();

export default function App() {
  const responseListener = useRef();

  useEffect(() => {
    // ติดตามสถานะออนไลน์/ออฟไลน์แบบ Realtime
    initUserPresence();

    // ขอสิทธิ์แจ้งเตือนตอนเปิดแอป
    registerForNotificationsAsync();

    // ติดตามสถานะการระงับบัญชี (Suspension) แบบ Realtime
    let unsubUserDoc = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      if (user) {
        unsubUserDoc = onSnapshot(
          doc(db, 'users', user.uid),
          async (snap) => {
            if (snap.exists() && snap.data()?.suspended) {
              if (unsubUserDoc) {
                unsubUserDoc();
                unsubUserDoc = null;
              }
              try {
                await signOut(auth);
              } catch (e) {}

              const currentRoute = navigationRef.isReady()
                ? navigationRef.getCurrentRoute()?.name
                : null;
              const isAuthScreen = ['Login', 'Register', 'Home1', 'Home2', 'Forgot', 'OTP', 'ResetPassword'].includes(currentRoute);

              // ถ้าผู้ใช้อยู่หน้า Login หรือยังไม่ได้เข้าแอป หน้า Login จะแสดงข้อความเตือนเอง ไม่ต้องเด้งซ้อน
              if (!isAuthScreen) {
                Alert.alert(
                  'บัญชีถูกระงับการใช้งาน',
                  'บัญชีของคุณถูกระงับการใช้งานโดยผู้ดูแลระบบ กรุณาติดต่อฝ่ายสนับสนุนหรือผู้ดูแลระบบ'
                );

                if (navigationRef.isReady()) {
                  navigationRef.reset({
                    index: 1,
                    routes: [{ name: 'Home2' }, { name: 'Login' }],
                  });
                }
              }
            }
          },
          (err) => {
            // ดักจับ error เงียบๆ หากถูกตัดสิทธิ์ระหว่าง sign out
          }
        );
      }
    });

    // จัดการเมื่อผู้ใช้แตะที่การแจ้งเตือน
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type;
      if (!navigationRef.isReady()) return;

      if (type === 'water-reminder') {
        navigationRef.navigate('HomeDashBoard');
      } else if (type === 'expiry-reminder') {
        navigationRef.navigate('HomeDashBoard', { screen: 'Pantry' });
      }
    });

    return () => {
      if (responseListener.current) {
        responseListener.current?.remove();
      }
      if (unsubUserDoc) {
        unsubUserDoc();
      }
      unsubAuth();
    };
  }, []);

  return (
    <LanguageProvider>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator
            initialRouteName="Home1"
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Home1" component={Home1} />
            <Stack.Screen name="Home2" component={Home2} />
            <Stack.Screen name="Register" component={Register} />
            <Stack.Screen name="Login" component={Login} />
            <Stack.Screen name="HomeDashBoard" component={MainTabs} />
            <Stack.Screen name="Forgot" component={Forgot} />
            <Stack.Screen name="OTP" component={OTP} />
            <Stack.Screen name="ResetPassword" component={ResetPassword} />
            <Stack.Screen name="QueName" component={QueName} />
            <Stack.Screen name="QueGender" component={QueGender} />
            <Stack.Screen name="QueGoal" component={QueGoal} />
            <Stack.Screen name="QueBirth" component={QueBirth} />
            <Stack.Screen name="QueBMI" component={QueBMI} />
            <Stack.Screen name="QueActivity" component={QueActivity} />
            <Stack.Screen name="Email" component={Email} />
            <Stack.Screen name="ConfirmPassword" component={ConfirmPassword} />
            <Stack.Screen name="ConfirmEmailOtp" component={ConfirmEmailOtp} />
            <Stack.Screen name="Username" component={Username} />
            <Stack.Screen name="Condition" component={Condition} />
            <Stack.Screen name="Family" component={FamilyScreen} />
            <Stack.Screen name="FamilyDetail" component={FamilyDetailScreen} />
            <Stack.Screen name="MemberDetail" component={MemberDetailScreen} />
            <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
            <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
            <Stack.Screen name="SeedData" component={SeedDataScreen} />
            <Stack.Screen name="Notifications" component={NotificationScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </LanguageProvider>
  );
}