import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as adminApi from '../../services/adminApi';
import Avatar from '../../components/ui/Avatar';
import RoleBadge from '../../components/ui/RoleBadge';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { usePanel } from '../../context/PanelContext';

const ROLES = ['all', 'teacher', 'student', 'admin'];

function FilterChip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function UserRow({ user, onPress }) {
  return (
    <TouchableOpacity style={styles.userRow} onPress={() => onPress(user)} activeOpacity={0.75}>
      <Avatar name={user.name} role={user.role} size="medium" />

      <View style={styles.details}>
        <View style={styles.nameLine}>
          <Text style={styles.nameText} numberOfLines={1}>{user.name}</Text>
          <RoleBadge role={user.role} style={{ alignSelf: 'center' }} />
        </View>
        <Text style={styles.subText} numberOfLines={1}>
          {user.subject || user.classGrade || user.phone || user.email || '—'}
        </Text>
      </View>

      <View style={styles.statusRight}>
        <StatusBadge status={user.isBanned ? 'banned' : user.status} />
        <Ionicons name="chevron-forward" size={16} color="#708499" style={{ marginTop: 2 }} />
      </View>
    </TouchableOpacity>
  );
}

export default function UserListScreen(props) {
  const { navigation } = props;
  const { goBackPanel, navigatePanel } = usePanel();
  const isInline = Platform.OS === 'web' && props.isInline;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [roleFilter, setRoleFilter] = useState('all');

  const fetchUsers = useCallback(async () => {
    try {
      setError('');
      const params = { page: 1, limit: 100 };
      if (roleFilter !== 'all') params.role = roleFilter;

      const res = await adminApi.getUsers(params);
      setUsers(res.data.users || []);
    } catch (_err) {
      setError('Failed to load users.');
    }
  }, [roleFilter]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchUsers().finally(() => setLoading(false));
    }, [fetchUsers])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  const handleUserPress = (user) => {
    if (isInline) {
      navigatePanel('userDetail', { userId: user._id });
    } else {
      navigation.navigate('UserDetail', { userId: user._id });
    }
  };

  return (
    <View style={styles.root}>
      {!isInline && <StatusBar barStyle="light-content" backgroundColor="#17212b" />}

      <View style={[styles.header, isInline && { paddingTop: 14 }]}>
        <TouchableOpacity onPress={() => isInline ? goBackPanel() : navigation.goBack()} style={{ paddingRight: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Users</Text>
        <TouchableOpacity onPress={() => isInline ? navigatePanel('pendingApprovals', null) : navigation.navigate('PendingApprovals')}>
          <Ionicons name="time-outline" size={22} color="#ffa726" />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        {/* Horizontal Chips Bar */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            <Text style={styles.filterLabel}>ROLE:</Text>
            {ROLES.map((r) => (
              <FilterChip key={r} label={r} active={roleFilter === r} onPress={() => setRoleFilter(r)} />
            ))}
          </ScrollView>
        </View>

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
            renderItem={({ item }) => <UserRow user={item} onPress={handleUserPress} />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#5288c1" />
            }
            ListEmptyComponent={<EmptyState title="No users found" subtitle="Try adjusting your filter options." />}
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
  filterSection: {
    backgroundColor: '#232e3c',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  chipScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 6,
  },
  filterLabel: {
    fontSize: 11,
    color: '#708499',
    fontWeight: '500',
    marginRight: 2,
  },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#5288c1',
  },
  chipInactive: {
    backgroundColor: '#2b3a4b',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  chipTextInactive: {
    color: '#708499',
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
  userRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
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
  statusRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
