import React, { useState } from 'react';
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
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function ForgotPinScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    const val = phone.trim();
    if (!val) {
      setErrorMsg('Please enter your phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/auth/forgot-pin', { phone: val });
      setSuccessMsg(res.data.message || 'Your request has been sent to the administrator. You will be notified once approved.');
    } catch (err) {
      if (err?.response?.status === 429) {
        setErrorMsg(err?.response?.data?.error || 'Too many reset requests. Please try again later.');
      } else {
        setErrorMsg(err?.response?.data?.error || 'Failed to submit request. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#2563eb" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reset PIN</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentCard}>
          <Ionicons 
            name="key-outline" 
            size={48} 
            color="#2563eb" 
            style={styles.icon} 
          />
          
          <Text style={styles.title}>Forgot Your PIN?</Text>
          <Text style={styles.subtitle}>
            Enter the phone number associated with your account. A reset request will be sent to the administrator.
          </Text>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{successMsg}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. +1234567890"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                value={phone}
                onChangeText={setPhone}
              />

              <TouchableOpacity
                style={[styles.button, isSubmitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.buttonText}>Send Reset Request</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#f1f5f9' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  contentCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    ...(Platform.OS === 'web' && {
      maxWidth: 480,
      alignSelf: 'center',
      width: '100%',
    }),
  },
  icon: { marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#f1f5f9', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: '600', alignSelf: 'flex-start' },
  input: {
    backgroundColor: '#0a0e1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    color: '#f1f5f9',
    fontSize: 15,
    width: '100%',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    marginBottom: 16,
  },
  errorText: { color: '#ef4444', fontSize: 13, textAlign: 'center', fontWeight: '600' },
  successBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 8,
    padding: 16,
    width: '100%',
  },
  successText: { color: '#10b981', fontSize: 14, textAlign: 'center', fontWeight: '600', lineHeight: 22 },
});
