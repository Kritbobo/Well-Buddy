import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LANGUAGE_KEYS, translate, setCurrentLang } from './appI18n';

const STORAGE_KEY = 'wellbuddy.lang';
const DEFAULT_LANG = 'th';

export const LanguageContext = createContext({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key, vars) => translate(DEFAULT_LANG, key, vars),
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);
  // อ่าน AsyncStorage เสร็จหรือยัง — งานที่ "เขียนข้อความค้างไว้" (เช่นสร้างแจ้งเตือนลง
  // Firestore) ต้องรอค่านี้ก่อน ไม่งั้นจะได้ภาษา default ไปแทนภาษาที่ผู้ใช้เลือกจริง
  const [ready, setReady] = useState(false);

  // อ่านภาษาที่เคยเลือกไว้ตอน mount
  // render children ทันทีโดยไม่รอโหลด — ถ้ารอ จะเห็นจอขาวแวบตอนเปิดแอป
  // ค่าที่อ่านได้จะมาทีหลังแล้วค่อย re-render ซึ่งเร็วจนไม่ทันเห็น
  useEffect(() => {
    let isActive = true;

    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (isActive && LANGUAGE_KEYS.includes(saved)) {
          setLangState(saved);
          setCurrentLang(saved); // ให้ไฟล์ที่ไม่ใช่ component (notificationRules) อ่านได้ด้วย
        }
      } catch (e) {
        // อ่านไม่ได้ก็ใช้ค่า default 'th' ต่อไป ห้ามให้แอปพัง
      } finally {
        // อ่านเสร็จแล้วไม่ว่าจะสำเร็จหรือพัง — ปลดล็อกให้งานที่รออยู่ทำต่อได้
        if (isActive) setReady(true);
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  // เปลี่ยนภาษาใน state ก่อนเสมอ แล้วค่อยเซฟ — เซฟไม่สำเร็จก็แค่ไม่จำข้ามรอบเปิดแอป
  const setLang = useCallback((key) => {
    if (!LANGUAGE_KEYS.includes(key)) return;
    setLangState(key);
    setCurrentLang(key); // ให้ไฟล์ที่ไม่ใช่ component (notificationRules) อ่านได้ด้วย
    AsyncStorage.setItem(STORAGE_KEY, key).catch(() => {});
  }, []);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, ready }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}