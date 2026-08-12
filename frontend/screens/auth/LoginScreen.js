import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { loginTeacherStudent } = useContext(AuthContext);

  const handleLogin = async () => {
    setErrorMsg('');
    if (!phone.trim() || !pin.trim()) {
      setErrorMsg('Please enter both phone number and 6-digit PIN.');
      return;
    }

    setIsSubmitting(true);
    const result = await loginTeacherStudent(phone.trim(), pin.trim());
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMsg(result.error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <View style={styles.headerContainer}>
            <Text style={styles.title}>ClassBridge</Text>
            <Text style={styles.subtitle}>Secure Academy Messaging</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>PHONE NUMBER</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. +1234567890"
              placeholderTextColor="#708499"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              autoCapitalize="none"
            />

            <Text style={styles.label}>6-DIGIT PIN</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 6-digit PIN"
              placeholderTextColor="#708499"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              value={pin}
              onChangeText={setPin}
            />

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <TouchableOpacity
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.footerLinks}>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotRequest', { type: 'pin' })}>
                <Text style={styles.linkText}>Forgot PIN?</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={{ marginTop: 14 }}>
                <Text style={styles.secondaryLinkText}>
                  Don't have an account? <Text style={styles.linkBold}>Sign Up</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ marginTop: 18 }}
                onPress={() => navigation.navigate('AdminLogin')}
              >
                <Text style={styles.adminLinkText}>Log in as Administrator</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#17212b',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#17212b',
    ...(Platform.OS === 'web' && {
      maxWidth: 480,
      alignSelf: 'center',
      width: '100%',
    }),
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#5288c1',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#708499',
    marginTop: 6,
    fontWeight: '400',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#708499',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: '#2b3a4b',
    borderRadius: 10,
    borderWidth: 0,
    color: '#ffffff',
    paddingHorizontal: 16,
    height: 52,
    fontSize: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#e53935',
    fontSize: 13,
    marginBottom: 14,
    marginLeft: 2,
  },
  button: {
    backgroundColor: '#5288c1',
    borderRadius: 10,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  footerLinks: {
    alignItems: 'center',
    marginTop: 24,
  },
  linkText: {
    color: '#5288c1',
    fontSize: 14,
    fontWeight: '500',
  },
  secondaryLinkText: {
    color: '#708499',
    fontSize: 14,
  },
  linkBold: {
    color: '#5288c1',
    fontWeight: '600',
  },
  adminLinkText: {
    color: '#5288c1',
    fontSize: 14,
    fontWeight: '500',
  },
});
