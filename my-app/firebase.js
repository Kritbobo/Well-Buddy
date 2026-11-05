import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCFo4mdckNuOeQld6kw38v9R9OTrtS0paY",
  authDomain: "wellbuddy-3ad83.firebaseapp.com",
  projectId: "wellbuddy-3ad83",
  storageBucket: "wellbuddy-3ad83.firebasestorage.app",
  messagingSenderId: "305933833057",
  appId: "1:305933833057:web:8e9b06f2a071c24a7aeb20"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const storage = getStorage(app);