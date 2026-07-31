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

export default function PromoteToAdminScreen({ route, navigation }) {
  const { user } = route.params;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePromote = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required for admin setup.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await adminApi.promoteToAdmin(user._id, {
        email: email.trim().toLowerCase(),
        password,
        note: note.trim() || undefined,
      });
      Alert.alert('Success', `User ${user.name} promoted to Admin successfully.`);
      navigation.navigate('AdminDashboard');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to promote user to admin.');
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
        <Text style={styles.headerTitle}>Promote to Admin</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Promoting User</Text>
          <Text style={styles.infoName}>{user.name}</Text>
          <Text style={styles.infoMeta}>Current Role: {user.role.toUpperCase()}</Text>
          <Text style={styles.infoMeta}>Phone: {user.phone || '—'}</Text>
        </View>

        <Text style={styles.label}>Admin Email Address</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. admin@classbridge.com"
          placeholderTextColor="#475569"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Admin Password (minimum 8 characters)</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#475569"
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>Promotion Note (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Reason for promotion..."
          placeholderTextColor="#475569"
          value={note}
          onChangeText={setNote}
        />

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handlePromote}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Promote Account</Text>
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
  infoCard: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  infoTitle: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  infoName: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  infoMeta: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
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
    backgroundColor: '#8b5cf6',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
