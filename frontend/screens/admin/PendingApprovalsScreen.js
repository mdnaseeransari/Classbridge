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
        <View style={styles.cardAvatar}>
          <Text style={styles.cardAvatarText}>{user.name?.[0]?.toUpperCase() || '?'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{user.name}</Text>
          <Text style={styles.cardPhone}>{user.phone || '—'}</Text>
          <Text style={styles.cardMeta}>{roleLabel}{extra ? ` · ${extra}` : ''}</Text>
          <Text style={styles.cardDate}>
            Registered: {new Date(user.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
      </View>

      {/* Optional Note */}
      <TextInput
        style={styles.noteInput}
        placeholder="Add note (optional)..."
        placeholderTextColor="#475569"
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
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

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
          <ActivityIndicator size="large" color="#fbbf24" />
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
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fbbf24" />
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
  backText: { color: '#38bdf8', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#f8fafc' },
  countBadge: {
    backgroundColor: '#fbbf2422',
    borderColor: '#fbbf24',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  countText: { color: '#fbbf24', fontWeight: '800', fontSize: 13 },
  errorBox: {
    margin: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: '#f87171', textAlign: 'center', fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  emptySubtext: { color: '#64748b', fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    marginBottom: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  cardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fbbf2422',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardAvatarText: { fontSize: 20, fontWeight: '800', color: '#fbbf24' },
  cardName: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  cardPhone: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  cardMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  cardDate: { fontSize: 11, color: '#475569', marginTop: 3 },
  noteInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
    color: '#f8fafc',
    fontSize: 13,
    marginBottom: 12,
    minHeight: 44,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  approveBtn: { backgroundColor: '#16a34a' },
  rejectBtn: { backgroundColor: '#dc2626' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
