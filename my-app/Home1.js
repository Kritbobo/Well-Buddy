  import React, { useEffect } from 'react';
  import { StyleSheet, Text, View, Image } from 'react-native';
  import { LinearGradient } from 'expo-linear-gradient';
  import { StatusBar } from 'expo-status-bar';

  export default function SplashScreen({ navigation }) {
    useEffect(() => {
      const timer = setTimeout(() => {
        navigation.replace('Home2');
      }, 2000);

      return () => clearTimeout(timer);
    }, []);

    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient
          colors={['#7FC97F', '#A8D97F', '#D4E68C', '#F2E491']}
          style={styles.gradient}
        >
          <View style={styles.iconPlaceholder}>
            <Image
              source={require('./assets/Squirrel.png')}
              style={styles.squirrelImage}
              resizeMode="contain"
            />
            <Image
              source={require('./assets/hamburger.png')}
              style={styles.burgerImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>WellBuddy</Text>
        </LinearGradient>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: { flex: 1 },
    gradient: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconPlaceholder: {
      width: 150,
      height: 150,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
      transform: [{ translateX: -80 }], // เขยิบไปทางซ้าย ปรับตัวเลขนี้ได้ตามต้องการ
      position: 'relative', // ให้ burgerImage วางซ้อนทับตำแหน่งที่กำหนดได้
    },
    squirrelImage: {
      width: '100%',
      height: '100%',
    },
    burgerImage: {
      position: 'absolute',
      width: 55,
      height: 55,
      bottom: 5, // ปรับตำแหน่งให้ตรงปากกระรอกตามรูปจริง
      right: -40,
    },
    title: {
      fontSize: 68,
      fontWeight: 'bold',
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
  });