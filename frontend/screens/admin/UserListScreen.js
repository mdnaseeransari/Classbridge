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
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as adminApi from '../../services/adminApi';

const ROLES = ['all', 'teacher', 'student', 'admin'];
const STATUSES = ['all', 'pending', 'approved', 'rejected'];

const ROLE_COLORS = {
  teacher: '#10b981',
  student: '#7c3aed',
  admin: '#2563eb',
  superadmin: '#2563eb',
};

const STATUS_COLORS = {
  pending: '#fbbf24',
  approved: '#34d399',
  rejected: '#ef4444',
};

function FilterPill({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function UserRow({ user, onPress }) {
  const roleColor = ROLE_COLORS[user.role] || '#94a3b8';
  const statusColor = STATUS_COLORS[user.status] || '#64748b';

  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(user)} activeOpacity={0.75}>
      <View style={styles.rowLeft}>
        <View style={[styles.avatar, { backgroundColor: roleColor + '22' }]}>
          <Text style={[styles.avatarText, { color: roleColor }]}>
            {user.name?.[0]?.toUpperCase() || '?'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName} numberOfLines={1}>{user.name}</Text>
          <Text style={styles.rowPhone} numberOfLines={1}>
            {user.phone || user.email || '—'}
          </Text>
          {user.subject ? (
            <Text style={styles.rowMeta}>{user.subject}</Text>
          ) : user.classGrade ? (
            <Text style={styles.rowMeta}>{user.classGrade}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        <View style={[styles.badge, { backgroundColor: roleColor + '22' }]}>
          <Text style={[styles.badgeText, { color: roleColor }]}>{user.role}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: statusColor + '22', marginTop: 4 }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{user.status}</Text>
        </View>
        {user.isBanned && (
          <View style={[styles.badge, { backgroundColor: '#ef444422', marginTop: 4 }]}>
            <Text style={[styles.badgeText, { color: '#ef4444' }]}>banned</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function UserListScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = useCallback(async (pageNum = 1, append = false) => {
    try {
      setError('');
      const params = { page: pageNum, limit: 20 };
      if (roleFilter !== 'all') params.role = roleFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await adminApi.getUsers(params);
      const fetched = res.data.users || [];
      setTotalPages(res.data.pagination?.totalPages || 1);

      if (append) {
        setUsers((prev) => [...prev, ...fetched]);
      } else {
        setUsers(fetched);
        setPage(1);
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load users.');
    }
  }, [roleFilter, statusFilter]);

  // Reload when filters change or screen is focused
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchUsers(1, false).finally(() => setLoading(false));
    }, [fetchUsers])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsers(1, false);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    const nextPage = page + 1;
    setPage(nextPage);
    setLoadingMore(true);
    await fetchUsers(nextPage, true);
    setLoadingMore(false);
  };

  const handleUserPress = (user) => {
    navigation.navigate('UserDetail', { userId: user._id });
  };

  const renderFooter = () => {
    if (loadingMore) return <ActivityIndicator color="#38bdf8" style={{ marginVertical: 16 }} />;
    if (page < totalPages) {
      return (
        <TouchableOpacity style={styles.loadMore} onPress={handleLoadMore}>
          <Text style={styles.loadMoreText}>Load More</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Users</Text>
        <TouchableOpacity onPress={() => navigation.navigate('PendingApprovals')}>
          <Text style={styles.pendingLink}>Pending ›</Text>
        </TouchableOpacity>
      </View>

      {/* Role Filters */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Role</Text>
        <View style={styles.pills}>
          {ROLES.map((r) => (
            <FilterPill
              key={r}
              label={r}
              active={roleFilter === r}
              onPress={() => setRoleFilter(r)}
            />
          ))}
        </View>
      </View>

      {/* Status Filters */}
      <View style={[styles.filterSection, { borderBottomWidth: 0 }]}>
        <Text style={styles.filterLabel}>Status</Text>
        <View style={styles.pills}>
          {STATUSES.map((s) => (
            <FilterPill
              key={s}
              label={s}
              active={statusFilter === s}
              onPress={() => setStatusFilter(s)}
            />
          ))}
        </View>
      </View>

      {/* Error */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => <UserRow user={item} onPress={handleUserPress} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No users found.</Text>
            </View>
          }
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        />
      )}
    </View>
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
  backBtn: { padding: 4 },
  backText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#f1f5f9' },
  pendingLink: { color: '#fbbf24', fontSize: 14, fontWeight: '600' },
  filterSection: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  filterLabel: { fontSize: 11, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#0a0e1a',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  pillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pillText: { fontSize: 12, color: '#64748b', fontWeight: '600', textTransform: 'capitalize' },
  pillTextActive: { color: '#fff' },
  errorBox: {
    margin: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: '#ef4444', textAlign: 'center', fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#64748b', fontSize: 15 },
  row: {
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800' },
  rowName: { fontSize: 15, fontWeight: '700', color: '#f1f5f9' },
  rowPhone: { fontSize: 12, color: '#64748b', marginTop: 2 },
  rowMeta: { fontSize: 11, color: '#64748b', marginTop: 1 },
  rowRight: { alignItems: 'flex-end', marginLeft: 8 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  loadMore: {
    margin: 16,
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  loadMoreText: { color: '#2563eb', fontWeight: '700', fontSize: 14 },
});
