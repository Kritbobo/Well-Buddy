import React, { useState, useRef, useCallback } from 'react';
import { loginUser, getUserRole, logoutUser } from './authservice';
import { checkSurveyExists } from './surveyService';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

export default function Login({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const insets = useSafeAreaInsets();

    // ---- แอนิเมชัน: เล่นใหม่ทุกครั้งที่เข้าหน้า ----
    const [replayKey, setReplayKey] = useState(0);
    const anims = useRef([0, 1, 2, 3, 4, 5].map(() => new Animated.Value(0))).current;

    useFocusEffect(
        useCallback(() => {
            anims.forEach((a) => a.setValue(0));
            setReplayKey((k) => k + 1);
            Animated.stagger(
                80,
                anims.map((a) =>
                    Animated.spring(a, {
                        toValue: 1, friction: 7, tension: 60,
                        useNativeDriver: true,
                    })
                )
            ).start();
        }, [])
    );

    // ทุกช่องเลื่อนขึ้นพร้อมจางเข้า — หน้านี้ไม่มีเงา ใช้ opacity ได้ไม่มีขอบดำ
    const inStyle = (i) => ({
        opacity: anims[i],
        transform: [
            { translateY: anims[i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
        ],
    });

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('กรอกข้อมูลไม่ครบ', 'กรุณากรอกอีเมลและรหัสผ่านให้ครบ');
            return;
        }

        setLoading(true);
        const result = await loginUser(email, password);

        if (!result.success) {
            setLoading(false);
            Alert.alert(result.isSuspended ? 'บัญชีถูกระงับการใช้งาน' : 'เข้าสู่ระบบไม่สำเร็จ', result.message);
            return;
        }

        const uid = result.user.uid;
        const userEmail = result.user.email;

        // เช็คก่อนว่า user คนนี้เป็น admin หรือ user ทั่วไป (หรือถูกระงับ)
        const role = await getUserRole(uid);

        if (role === 'suspended') {
            await logoutUser();
            setLoading(false);
            Alert.alert('บัญชีถูกระงับการใช้งาน', 'บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
            return;
        }

        if (role === 'admin') {
            setLoading(false);
            navigation.replace('AdminDashboard');
            return;
        }

        const done = await checkSurveyExists(uid);
        setLoading(false);

        if (done) {
            navigation.replace('HomeDashBoard');
        } else {
            navigation.replace('QueName', { uid, email: userEmail });
        }
    };

    return (
        <View
            style={[
                styles.container,
                { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 },
            ]}
        >
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* ปุ่มย้อนกลับ */}
                    <Animated.View style={{
                        opacity: anims[0],
                        transform: [{
                            translateX: anims[0].interpolate({
                                inputRange: [0, 1], outputRange: [-24, 0],
                            }),
                        }],
                    }}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => {
                                if (navigation.canGoBack()) {
                                    navigation.goBack();
                                } else {
                                    navigation.navigate('Home2');
                                }
                            }}
                        >
                            <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
                        </TouchableOpacity>
                    </Animated.View>

                    {/* หัวข้อ */}
                    <Animated.Text style={[styles.title, inStyle(1)]}>
                        เข้าสู่ระบบ
                    </Animated.Text>

                    {/* ช่องกรอกอีเมล */}
                    <Animated.View style={[styles.fieldGroup, inStyle(2)]}>
                        <Text style={styles.label}>อีเมลล์</Text>
                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            placeholder=""
                            placeholderTextColor="#A0A0A0"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </Animated.View>

                    {/* ช่องกรอกรหัสผ่าน */}
                    <Animated.View style={[styles.fieldGroup, inStyle(3)]}>
                        <Text style={styles.label}>รหัสผ่าน</Text>
                        <View style={styles.passwordWrapper}>
                            <TextInput
                                style={styles.passwordInput}
                                value={password}
                                onChangeText={setPassword}
                                placeholder=""
                                placeholderTextColor="#A0A0A0"
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity
                                style={styles.eyeIcon}
                                onPress={() => setShowPassword((prev) => !prev)}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                                    size={20}
                                    color="#888888"
                                />
                            </TouchableOpacity>
                        </View>
                    </Animated.View>

                    {/* ลืมรหัสผ่าน */}
                    <Animated.View style={[styles.forgotContainer, inStyle(4)]}>
                        <TouchableOpacity onPress={() => navigation.navigate('Forgot')}>
                            <Text style={styles.forgotText}>ลืมรหัสผ่าน?</Text>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* ปุ่มล็อกอิน + ลิงก์สมัคร */}
                    <Animated.View style={inStyle(5)}>
                        <TouchableOpacity
                            style={[styles.loginButton, loading && { opacity: 0.7 }]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.loginButtonText}>ล็อกอิน</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.registerContainer}>
                            <Text style={styles.registerText}>ยังไม่มีบัญชี? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                                <Text style={styles.registerLink}>สมัครสมาชิก</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 24,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#1A1A1A',
        textAlign: 'center',
        marginTop: 24,
        marginBottom: 32,
    },
    fieldGroup: {
        marginBottom: 22,
    },
    label: {
        fontSize: 14,
        color: '#444444',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#EEF3F9',
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 16,
        fontSize: 15,
        color: '#1A1A1A',
    },
    passwordWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF3F9',
        borderRadius: 14,
        paddingHorizontal: 16,
    },
    passwordInput: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 15,
        color: '#1A1A1A',
    },
    eyeIcon: {
        padding: 4,
    },
    forgotContainer: {
        alignItems: 'flex-end',
        marginBottom: 20,
    },
    forgotText: {
        color: '#6FB84C',
        fontSize: 13,
        fontWeight: '600',
    },
    loginButton: {
        backgroundColor: '#6FB84C',
        borderRadius: 26,
        paddingVertical: 16,
        alignItems: 'center',
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    registerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 16,
    },
    registerText: {
        color: '#888888',
        fontSize: 13,
    },
    registerLink: {
        color: '#6FB84C',
        fontSize: 13,
        fontWeight: 'bold',
    },
});