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
  Alert,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';

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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>ClassBridge</Text>
          <Text style={styles.subtitle}>Teacher & Student Login</Text>
        </View>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. +1234567890"
            placeholderTextColor="#94a3b8"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            autoCapitalize="none"
          />

          <Text style={styles.label}>6-Digit PIN</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 6-digit PIN"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            value={pin}
            onChangeText={setPin}
          />

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Log In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => navigation.navigate('ForgotRequest', { type: 'pin' })} style={{ marginBottom: 12 }}>
              <Text style={[styles.linkText, { color: '#38bdf8', fontWeight: '600', textAlign: 'center' }]}>Forgot PIN?</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkBold}>Sign Up</Text></Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ marginTop: 16 }}
              onPress={() => navigation.navigate('AdminLogin')}
            >
              <Text style={styles.adminLinkText}>Log in as Administrator</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 6,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0a0e1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    color: '#f1f5f9',
    padding: 14,
    fontSize: 16,
    marginBottom: 18,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerLinks: {
    alignItems: 'center',
    marginTop: 24,
  },
  linkText: {
    color: '#64748b',
    fontSize: 14,
  },
  linkBold: {
    color: '#2563eb',
    fontWeight: '700',
  },
  adminLinkText: {
    color: '#64748b',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
