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
import { COLORS, SPACING, RADIUS } from '../../theme';

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
      navigation.navigate('AdminTabs');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to promote user to admin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
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
          placeholderTextColor={COLORS.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Admin Password (minimum 8 characters)</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={COLORS.textSecondary}
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>Promotion Note (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Reason for promotion..."
          placeholderTextColor={COLORS.textSecondary}
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
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  backText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  body: { padding: 20 },
  infoCard: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 20,
  },
  infoTitle: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 4 },
  infoName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  infoMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 14,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  errorBox: {
    marginTop: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: COLORS.danger,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: COLORS.danger, textAlign: 'center', fontSize: 13 },
  btn: {
    marginTop: 24,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: RADIUS.button,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
