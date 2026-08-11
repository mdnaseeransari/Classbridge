import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, Platform, Alert } from 'react-native';

if (Platform.OS === 'web') {
  Alert.alert = (title, message, buttons) => {
    const text = `${title}${message ? '\n\n' + message : ''}`;
    if (buttons && buttons.length > 0) {
      const cancelBtn = buttons.find((b) => b.style === 'cancel');
      const actionBtn = buttons.find((b) => b.style !== 'cancel') || buttons[0];
      const confirmAction = window.confirm(text);
      if (confirmAction) {
        if (actionBtn && actionBtn.onPress) actionBtn.onPress();
      } else {
        if (cancelBtn && cancelBtn.onPress) cancelBtn.onPress();
      }
    } else {
      window.alert(text);
    }
  };

  Alert.prompt = (title, message, callbackOrButtons, type, defaultValue) => {
    const text = `${title}${message ? '\n\n' + message : ''}`;
    const value = window.prompt(text, defaultValue || '');
    if (value !== null) {
      if (typeof callbackOrButtons === 'function') {
        callbackOrButtons(value);
      } else if (Array.isArray(callbackOrButtons)) {
        const okBtn = callbackOrButtons.find((b) => b.style !== 'cancel') || callbackOrButtons[0];
        if (okBtn && okBtn.onPress) okBtn.onPress(value);
      }
    }
  };
}

import { AuthProvider } from './context/AuthContext';
import AppNavigator from './navigation/AppNavigator';

function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      setIsOffline(!navigator.onLine);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>📶 You are offline. Connection is limited.</Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <OfflineBanner />
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    zIndex: 9999,
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
