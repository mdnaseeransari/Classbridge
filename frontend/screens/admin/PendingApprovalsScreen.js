import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as adminApi from '../../services/adminApi';
import Avatar from '../../components/ui/Avatar';
import RoleBadge from '../../components/ui/RoleBadge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingScreen from '../../components/ui/LoadingScreen';

function PendingRow({ user, onApprove, onReject, loading }) {
  const extra = user.subject || user.classGrade || user.phone || '—';

  return (
    <View style={styles.pendingRow}>
      <Avatar name={user.name} role={user.role} size="medium" />

      <View style={styles.details}>
        <View style={styles.nameLine}>
          <Text style={styles.nameText} numberOfLines={1}>{user.name}</Text>
          <RoleBadge role={user.role} style={{ alignSelf: 'center' }} />
        </View>
        <Text style={styles.subText} numberOfLines={1}>{extra}</Text>
      </View>

      <View style={styles.actionButtons}>
        {loading ? (
          <ActivityIndicator size="small" color="#5288c1" />
        ) : (
          <>
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: '#e53935' }]}
              onPress={() => onReject(user._id)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={16} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: '#4dbd74' }]}
              onPress={() => onApprove(user._id)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark" size={16} color="#ffffff" />
            </TouchableOpacity>
          </>
        )}
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
    } catch (_err) {
      setError('Failed to load pending users.');
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

  const handleApprove = async (userId) => {
    setActionLoading((prev) => ({ ...prev, [userId]: true }));
    try {
      await adminApi.approveUser(userId, '');
      setUsers((prev) => prev.filter((u) => u._id !== userId));
    } catch (_err) {
      // silent fail
    } finally {
      setActionLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const handleReject = async (userId) => {
    if (Platform.OS === 'web') {
      const confirm = window.confirm('Are you sure you want to reject this application?');
      if (!confirm) return;
      setActionLoading((prev) => ({ ...prev, [userId]: true }));
      try {
        await adminApi.rejectUser(userId, '');
        setUsers((prev) => prev.filter((u) => u._id !== userId));
      } catch (_err) {
        // silent fail
      } finally {
        setActionLoading((prev) => ({ ...prev, [userId]: false }));
      }
      return;
    }

    Alert.alert(
      'Reject Application',
      'Are you sure you want to reject this application?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setActionLoading((prev) => ({ ...prev, [userId]: true }));
            try {
              await adminApi.rejectUser(userId, '');
              setUsers((prev) => prev.filter((u) => u._id !== userId));
            } catch (_err) {
              // silent fail
            } finally {
              setActionLoading((prev) => ({ ...prev, [userId]: false }));
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#17212b" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pending Approvals</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{users.length}</Text>
        </View>
      </View>

      <View style={styles.container}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <LoadingScreen />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <PendingRow
                user={item}
                loading={!!actionLoading[item._id]}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#5288c1" />
            }
            ListEmptyComponent={
              <EmptyState title="No pending approvals" subtitle="All registration applications have been reviewed." />
            }
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#17212b',
  },
  container: {
    flex: 1,
    backgroundColor: '#17212b',
    ...(Platform.OS === 'web' && {
      maxWidth: 480,
      alignSelf: 'center',
      width: '100%',
    }),
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#17212b',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  countBadge: {
    backgroundColor: '#5288c1',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  errorBox: {
    margin: 16,
    backgroundColor: 'rgba(229, 57, 53, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#e53935',
    textAlign: 'center',
    fontSize: 13,
  },
  pendingRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  details: {
    flex: 1,
    marginLeft: 12,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  subText: {
    fontSize: 12,
    color: '#708499',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  smallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
