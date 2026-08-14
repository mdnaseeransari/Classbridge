import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';

export default function ChangePinScreen() {
  const { logout, checkPinChangeDone } = useContext(AuthContext);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
    setErrorMsg('');
    if (!/^\d{6}$/.test(newPin)) {
      setErrorMsg('PIN must be exactly 6 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg('PINs do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.patch('/auth/change-pin', { newPin, confirmPin });
      // Notify context that PIN is changed
      await checkPinChangeDone();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to update PIN.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Security Update</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentCard}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed" size={48} color="#2563eb" />
          </View>
          <Text style={styles.title}>Change Your PIN</Text>
          <Text style={styles.subtitle}>
            Your administrator has reset your PIN. You must configure a new 6-digit PIN before proceeding.
          </Text>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>NEW 6-DIGIT PIN</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter new 6-digit PIN"
            placeholderTextColor="#475569"
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            value={newPin}
            onChangeText={setNewPin}
          />

          <Text style={styles.label}>CONFIRM PIN</Text>
          <TextInput
            style={styles.input}
            placeholder="Confirm new 6-digit PIN"
            placeholderTextColor="#475569"
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            value={confirmPin}
            onChangeText={setConfirmPin}
          />

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            disabled={isSubmitting}
            onPress={handleSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Update PIN</Text>
            )}
          </TouchableOpacity>
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
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#f1f5f9' },
  logoutBtn: { paddingVertical: 4, paddingHorizontal: 10 },
  logoutText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  contentCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
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
    marginTop: 10,
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
});
