import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import * as adminApi from '../../services/adminApi';

export default function CreateAdminScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await adminApi.createAdmin({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      Alert.alert('Success', 'Admin account created successfully.');
      navigation.goBack();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create admin account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Admin</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. John Doe"
          placeholderTextColor="#475569"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. john@classbridge.com"
          placeholderTextColor="#475569"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password (minimum 8 characters)</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#475569"
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
        />

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Create Admin Account</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backText: { color: '#64748b', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#f8fafc' },
  body: { padding: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    color: '#f8fafc',
    fontSize: 15,
  },
  errorBox: {
    marginTop: 20,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: '#f87171', textAlign: 'center', fontSize: 13 },
  btn: {
    marginTop: 24,
    backgroundColor: '#f472b6',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
