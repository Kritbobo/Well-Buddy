import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, Animated, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from './firebase';
import { db } from './firebase';
import { getUserProfile } from './surveyService';
import { chatWithNutriBot, chatWithGroq } from './geminiService';
import { useLang } from './LanguageContext';
import {
  collection, doc, addDoc, updateDoc, onSnapshot,
  orderBy, query, serverTimestamp, setDoc, getDoc,
} from 'firebase/firestore';

const QUICK_ASKS = [
  'วันนี้ควรกินโปรตีนเท่าไหร่',
  'แนะนำมื้อเย็นหน่อย',
  'BMI ผมโอเคไหม',
  'ของว่างอะไรดี',
];

const GREETING_TEXT = `สวัสดีครับ ผม NutriBot 🌿
ถามเรื่องอาหารหรือโภชนาการได้เลย ผมรู้ข้อมูลสุขภาพของคุณอยู่แล้ว`;

const ADMIN_EMPTY_TEXT = 'ยังไม่มีข้อความ — พิมพ์คำถามหรือเรื่องที่ต้องการสอบถาม แอดมินจะตอบกลับโดยเร็วที่สุด';

function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, { toValue: -5, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(300 - i * 150),
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []);
  return (
    <View style={styles.typingBubble}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={[styles.dot, { transform: [{ translateY: d }] }]} />
      ))}
    </View>
  );
}

function Bubble({ item }) {
  const { t } = useLang();
  const anim = useRef(new Animated.Value(0)).current;
  const isUser = item.role === 'user';
  const isAdmin = item.role === 'admin';
  // ข้อความทักทายถูกเก็บลง Firestore เป็นภาษาไทยตอนเปิดแชทครั้งแรก — แปลตอนแสดงผลแทน
  const text = !isUser && !isAdmin && item.text === GREETING_TEXT ? t(GREETING_TEXT) : item.text;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }).start();
  }, []);

  const style = {
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
    ],
  };

  return (
    <Animated.View style={[styles.bubbleRow, isUser && { justifyContent: 'flex-end' }, style]}>
      {!isUser && !isAdmin && (
        <View style={styles.botAvatar}>
          <Ionicons name="leaf" size={13} color="#FFFFFF" />
        </View>
      )}
      {isAdmin && (
        <View style={[styles.botAvatar, { backgroundColor: '#8A93A6' }]}>
          <Ionicons name="person" size={13} color="#FFFFFF" />
        </View>
      )}

      <View style={{ maxWidth: '78%' }}>
        {isUser ? (
          <LinearGradient
            colors={['#7FC97F', '#6FB84C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bubble, styles.bubbleUser]}
          >
            <Text style={[styles.bubbleText, { color: '#FFFFFF' }]}>{item.text}</Text>
          </LinearGradient>
        ) : isAdmin ? (
          <View style={[styles.bubble, styles.bubbleBot]}>
            <Text style={[styles.bubbleLabel]}>{t('แอดมิน')}</Text>
            <Text style={styles.bubbleText}>{item.text}</Text>
          </View>
        ) : (
          <View style={[styles.bubble, styles.bubbleBot]}>
            <Text style={styles.bubbleText}>{text}</Text>
          </View>
        )}
        <Text style={[styles.time, isUser && { textAlign: 'right' }]}>{item.time || ''}</Text>
      </View>
    </Animated.View>
  );
}

const now = () =>
  new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

const mapDocs = (snap) =>
  snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      role: data.role,
      text: data.text,
      createdAt: data.createdAt,
      time: data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        : now(),
    };
  });

export default function ChatScreen({ route }) {
  const insets = useSafeAreaInsets();
  const { lang, t } = useLang();
  const listRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [uid, setUid] = useState(null);

  // ── สองเธรดแยกกันเด็ดขาด: บอท กับ แอดมิน ──
  const [activeTab, setActiveTab] = useState(route?.params?.mode === 'admin' ? 'admin' : 'bot');
  const [botMessages, setBotMessages] = useState([]);
  const [adminMessages, setAdminMessages] = useState([]);
  const [unreadUser, setUnreadUser] = useState(0); // ข้อความจากแอดมินที่ยังไม่ได้เปิดดู

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Init on mount ─────────────────────────
  useEffect(() => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    setUid(currentUid);

    getUserProfile(currentUid).then(setProfile);
    initChatSession(currentUid);

    // เธรดบอท — chats/{uid}/messages
    const qBot = query(collection(db, 'chats', currentUid, 'messages'), orderBy('createdAt', 'asc'));
    const unsubBot = onSnapshot(qBot, (snap) => setBotMessages(mapDocs(snap)));

    // เธรดแอดมิน — chats/{uid}/adminMessages (แยกจากบอทเด็ดขาด)
    const qAdmin = query(collection(db, 'chats', currentUid, 'adminMessages'), orderBy('createdAt', 'asc'));
    const unsubAdmin = onSnapshot(qAdmin, (snap) => setAdminMessages(mapDocs(snap)));

    // นับข้อความจากแอดมินที่ยังไม่อ่าน (โชว์เป็นจุดแดงบนแท็บ)
    const chatRef = doc(db, 'chats', currentUid);
    const unsubChat = onSnapshot(chatRef, (snap) => {
      if (snap.exists()) setUnreadUser(snap.data().unreadUser || 0);
    });

    return () => {
      unsubBot();
      unsubAdmin();
      unsubChat();
    };
  }, []);

  const initChatSession = async (currentUid) => {
    const chatRef = doc(db, 'chats', currentUid);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) {
      await setDoc(chatRef, {
        unreadAdmin: 0,
        unreadUser: 0,
        userName: '',
        lastMessage: '',
        lastAt: serverTimestamp(),
      });
      // ทักทายในเธรดบอทเท่านั้น — เธรดแอดมินไม่มีข้อความอัตโนมัติ
      await addDoc(collection(db, 'chats', currentUid, 'messages'), {
        role: 'model',
        text: GREETING_TEXT,
        createdAt: serverTimestamp(),
      });
    }
  };

  // ── Update profile name into chat doc when profile loads ─────────
  useEffect(() => {
    if (uid && profile?.name) {
      updateDoc(doc(db, 'chats', uid), { userName: profile.name }).catch(() => {});
    }
  }, [uid, profile]);

  // ── ถ้าถูกนำทางมาพร้อม param mode: 'admin' (เช่นกดปุ่ม "สอบถาม" จากหน้า Home)
  //    ให้เปิดแท็บแอดมินทันที โดยไม่ต้องกดสลับเอง ──
  useEffect(() => {
    if (route?.params?.mode === 'admin') setActiveTab('admin');
  }, [route?.params?.mode]);

  // ── เคลียร์ badge ข้อความแอดมินที่ยังไม่อ่าน ทุกครั้งที่เปิดแท็บแอดมิน ──
  useEffect(() => {
    if (uid && activeTab === 'admin') {
      updateDoc(doc(db, 'chats', uid), { unreadUser: 0 }).catch(() => {});
    }
  }, [uid, activeTab]);

  const isAdminTab = activeTab === 'admin';
  const messages = isAdminTab ? adminMessages : botMessages;

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;

    setInput('');
    setLoading(true);

    try {
      if (isAdminTab) {
        // ── เธรดแอดมิน: บันทึกเข้า adminMessages เท่านั้น ไม่ยุ่งกับบอท ──
        const chatRef = doc(db, 'chats', uid);
        await addDoc(collection(db, 'chats', uid, 'adminMessages'), {
          role: 'user',
          text: question,
          createdAt: serverTimestamp(),
        });
        const chatSnap = await getDoc(chatRef);
        const currentUnread = chatSnap.data()?.unreadAdmin || 0;
        await updateDoc(chatRef, {
          lastMessage: question,
          lastAt: serverTimestamp(),
          unreadAdmin: currentUnread + 1,
        });
      } else {
        // ── เธรดบอท: บันทึกเข้า messages แล้วให้ AI ตอบกลับ ──
        await addDoc(collection(db, 'chats', uid, 'messages'), {
          role: 'user',
          text: question,
          createdAt: serverTimestamp(),
        });
        const history = botMessages.slice(-10).map((m) => ({ role: m.role, text: m.text }));
        // ใช้ Groq เป็นหลัก (ฟรีวันละ 1,000 ครั้ง) เพราะ Gemini ฟรีได้แค่ 20 ครั้ง/วัน และต้องเก็บไว้ให้เมนูแนะนำ
        // Groq ล่มเมื่อไหร่ค่อยลอง Gemini — ส่งภาษาที่เลือกไปด้วย ให้ตอบอังกฤษเมื่อตั้งเป็น EN
        let answer;
        try {
          answer = await chatWithGroq(profile, question, history, null, lang);
        } catch (groqErr) {
          console.log('groq error, trying gemini:', groqErr.message);
          answer = await chatWithNutriBot(profile, question, history, null, lang);
        }
        await addDoc(collection(db, 'chats', uid, 'messages'), {
          role: 'model',
          // โมเดลชอบใส่ markdown (**ตัวหนา**, ### หัวข้อ) แต่ฟองแชทแสดงตัวอักษรตรง ๆ — ตัดเครื่องหมายออก
          text: answer.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#+\s*/gm, ''),
          createdAt: serverTimestamp(),
        });
      }
    } catch (e) {
      if (!isAdminTab) {
        await addDoc(collection(db, 'chats', uid, 'messages'), {
          role: 'model',
          text: t('ขออภัย เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'),
          createdAt: serverTimestamp(),
        });
      }
      console.log('chat error:', e.message);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      {/* Header gradient */}
      <LinearGradient
        colors={['#7FC97F', '#D4E157']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerAvatar}>
          <Ionicons name={isAdminTab ? 'headset' : 'leaf'} size={20} color="#6FB84C" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{isAdminTab ? 'WellBuddy' : 'NutriBot'}</Text>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerSub}>
              {isAdminTab
                ? t('ติดต่อสอบถาม admin')
                : profile
                ? t('ผู้ช่วยของ {name}', { name: profile.name || t('คุณ') })
                : t('กำลังโหลด...')}
            </Text>
          </View>
        </View>
        {!isAdminTab && profile?.calories ? (
          <View style={styles.kcalChip}>
            <Text style={styles.kcalValue}>{profile.calories}</Text>
            <Text style={styles.kcalLabel}>{t('kcal/วัน')}</Text>
          </View>
        ) : null}

        {/* ── ปุ่มติดต่อ Admin มุมขวาบน ── */}
        <TouchableOpacity
          style={[styles.adminIconBtn, isAdminTab && styles.adminIconBtnActive]}
          onPress={() => setActiveTab(isAdminTab ? 'bot' : 'admin')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isAdminTab ? 'leaf' : 'headset'}
            size={18}
            color={isAdminTab ? '#6FB84C' : '#FFFFFF'}
          />
          {unreadUser > 0 && !isAdminTab && (
            <View style={styles.adminIconBadge}>
              <Text style={styles.adminIconBadgeText}>{unreadUser > 9 ? '9+' : unreadUser}</Text>
            </View>
          )}
        </TouchableOpacity>
      </LinearGradient>

      {isAdminTab && (
        <View style={styles.adminInfoBanner}>
          <Ionicons name="information-circle-outline" size={14} color="#78350F" />
          <Text style={styles.adminInfoText}>{t('ข้อความของคุณจะถูกส่งถึง Admin โดยตรง แยกจากบทสนทนากับ NutriBot')}</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 70}
      >
        {isAdminTab && messages.length === 0 ? (
          <View style={styles.adminEmptyState}>
            <Ionicons name="chatbubbles-outline" size={36} color="#C7D8C0" />
            <Text style={styles.adminEmptyText}>{t(ADMIN_EMPTY_TEXT)}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            renderItem={({ item }) => <Bubble item={item} />}
            keyExtractor={(item, i) => item.id || String(i)}
            contentContainerStyle={{ padding: 16, paddingBottom: 4 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={loading ? <TypingDots /> : null}
          />
        )}

        {messages.length <= 1 && !loading && !isAdminTab && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickScroll}
            contentContainerStyle={styles.quickRow}
          >
            {QUICK_ASKS.map((q) => (
              <TouchableOpacity key={q} style={styles.quickChip} onPress={() => send(t(q))}>
                <Text style={styles.quickText}>{t(q)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={[styles.inputRow, { marginBottom: 110 }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={isAdminTab ? t('ส่งข้อความถึง Admin...') : t('พิมพ์คำถาม...')}
            placeholderTextColor="#B0B0B0"
            multiline
          />
          <TouchableOpacity
            onPress={() => send()}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={!input.trim() || loading ? ['#D8D8D8', '#C8C8C8'] : ['#7FC97F', '#6FB84C']}
              style={styles.sendButton}
            >
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9F5' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  kcalChip: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6,
    alignItems: 'center',
  },
  kcalValue: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  kcalLabel: { fontSize: 9, color: 'rgba(255,255,255,0.9)' },

  // ── ปุ่มติดต่อ Admin มุมขวาบน ──
  adminIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  adminIconBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  adminIconBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#E05D5D',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 2,
  },
  adminIconBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF' },

  adminInfoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3C7', paddingHorizontal: 16, paddingVertical: 8,
    marginHorizontal: 16, marginTop: 8, borderRadius: 10,
  },
  adminInfoText: { fontSize: 12, color: '#78350F', fontWeight: '500', flex: 1 },

  adminEmptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 10,
  },
  adminEmptyText: {
    fontSize: 13, color: '#9AA79A', textAlign: 'center', lineHeight: 20,
  },

  bubbleRow: { flexDirection: 'row', marginBottom: 14, gap: 8, alignItems: 'flex-end' },
  botAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#6FB84C',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  bubble: { borderRadius: 18, paddingVertical: 11, paddingHorizontal: 15 },
  bubbleBot: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 5,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  bubbleUser: { borderBottomRightRadius: 5 },
  bubbleText: { fontSize: 15, color: '#1A1A1A', lineHeight: 22 },
  bubbleLabel: { fontSize: 10, color: '#8A93A6', fontWeight: '600', marginBottom: 3 },
  time: { fontSize: 10, color: '#BBBBBB', marginTop: 4, marginHorizontal: 4 },

  typingBubble: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    alignSelf: 'flex-start', marginLeft: 34,
    backgroundColor: '#FFFFFF', borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#9BCB7E' },

  quickScroll: { flexGrow: 0, maxHeight: 46 },
  quickRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8, alignItems: 'center' },
  quickChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: '#DCEBD0',
    borderRadius: 18, paddingVertical: 9, paddingHorizontal: 14,
  },
  quickText: { fontSize: 13, color: '#4C7C3B', fontWeight: '600' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#EFEFEF',
  },
  input: {
    flex: 1, maxHeight: 100, minHeight: 44,
    backgroundColor: '#F2F5F0', borderRadius: 22,
    paddingHorizontal: 18, paddingVertical: 11,
    fontSize: 15, color: '#1A1A1A',
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
});