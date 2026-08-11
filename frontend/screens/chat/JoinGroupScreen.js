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
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { COLORS, SPACING, RADIUS } from '../../theme';

export default function JoinGroupScreen({ navigation }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async () => {
    if (!code.trim()) {
      setError('Please enter a group invite code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.post(`/chat/groups/join/${code.trim()}`);
      const conversation = res.data.conversation;
      Alert.alert('Success', res.data.message || 'Successfully joined the group.');
      navigation.replace('ChatRoom', {
        conversationId: conversation._id,
        title: conversation.name,
      });
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to join group. Check the invite code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="close" size={18} color={COLORS.textSecondary} />
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join Group</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>Invite Code</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. GR-7A9B"
          placeholderTextColor={COLORS.textSecondary}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
        />

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleJoin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Join Group</Text>
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
