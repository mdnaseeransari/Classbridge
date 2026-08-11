import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as adminApi from '../../services/adminApi';
import { COLORS, SPACING, RADIUS } from '../../theme';

function PendingCard({ user, onApprove, onReject, loading }) {
  const [note, setNote] = useState('');

  const roleLabel = user.role === 'teacher' ? `📚 Teacher` : `🎒 Student`;
  const extra = user.subject
    ? `Subject: ${user.subject}`
    : user.classGrade
    ? `Class/Grade: ${user.classGrade}`
    : '';

  return (
    <View style={styles.card}>
      {/* User Info */}
      <View style={styles.cardHeader}>
        <View style={[styles.cardAvatar, { backgroundColor: user.role === 'teacher' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(124, 58, 237, 0.1)' }]}>
          <Text style={[styles.cardAvatarText, { color: user.role === 'teacher' ? '#10b981' : '#7c3aed' }]}>
            {user.name?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{user.name}</Text>
          <Text style={styles.cardPhone}>{user.phone || '—'}</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <View style={[styles.roleBadge, { backgroundColor: user.role === 'teacher' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(124, 58, 237, 0.1)' }]}>
              <Text style={[styles.roleBadgeText, { color: user.role === 'teacher' ? '#10b981' : '#7c3aed' }]}>
                {user.role.toUpperCase()}
              </Text>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: 'rgba(251, 191, 36, 0.1)' }]}>
              <Text style={[styles.roleBadgeText, { color: '#fbbf24' }]}>
                {user.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {extra ? <Text style={styles.cardMeta}>{extra}</Text> : null}
          <Text style={styles.cardDate}>
            Registered: {new Date(user.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
      </View>

      {/* Optional Note */}
      <TextInput
        style={styles.noteInput}
        placeholder="Add note (optional)..."
        placeholderTextColor={COLORS.textSecondary}
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={2}
      />

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.rejectBtn]}
          onPress={() => onReject(user._id, note)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.actionBtnText}>✕  Reject</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.approveBtn]}
          onPress={() => onApprove(user._id, note)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.actionBtnText}>✓  Approve</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PendingApprovalsScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState('');

  const fetchPending = useCallback(async () => {
    try {
      setError('');
      const res = await adminApi.getUsers({ status: 'pending', limit: 100 });
      setUsers(res.data.users || []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load pending users.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchPending().finally(() => setLoading(false));
    }, [fetchPending])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPending();
    setRefreshing(false);
  };

  const handleApprove = async (userId, note) => {
    setActionLoading((prev) => ({ ...prev, [userId]: true }));
    try {
      await adminApi.approveUser(userId, note);
      setUsers((prev) => prev.filter((u) => u._id !== userId));
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to approve user.');
    } finally {
      setActionLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleReject = async (userId, note) => {
    Alert.alert(
      'Reject Account',
      'Are you sure you want to reject this application?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setActionLoading((prev) => ({ ...prev, [userId]: true }));
            try {
              await adminApi.rejectUser(userId, note);
              setUsers((prev) => prev.filter((u) => u._id !== userId));
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to reject user.');
            } finally {
              setActionLoading((prev) => ({ ...prev, [userId]: false }));
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pending Approvals</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{users.length}</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <PendingCard
              user={item}
              loading={!!actionLoading[item._id]}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.accent} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>🎉</Text>
              <Text style={styles.emptyText}>No pending approvals!</Text>
              <Text style={styles.emptySubtext}>All sign-ups have been reviewed.</Text>
            </View>
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 40, flexGrow: 1 }}
        />
      )}
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
  backText: { color: COLORS.accent, fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  countBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  countText: { color: COLORS.accent, fontWeight: '800', fontSize: 13 },
  errorBox: {
    margin: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: COLORS.danger,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: COLORS.danger, textAlign: 'center', fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  emptySubtext: { color: COLORS.textSecondary, fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    marginBottom: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardHeader: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  cardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardAvatarText: { fontSize: 20, fontWeight: '800', color: COLORS.accent },
  cardName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  cardPhone: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cardDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
  noteInput: {
    backgroundColor: COLORS.bg,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 10,
    color: COLORS.textPrimary,
    fontSize: 13,
    marginBottom: 12,
    minHeight: 44,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.button,
    alignItems: 'center',
  },
  approveBtn: { backgroundColor: COLORS.success },
  rejectBtn: { backgroundColor: COLORS.danger },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
});
