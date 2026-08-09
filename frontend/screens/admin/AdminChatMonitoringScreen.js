import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';

export default function AdminChatMonitoringScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'direct' | 'group'

  const fetchConversations = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const params = {
        page: 1,
        limit: 100,
        type: filterType !== 'all' ? filterType : undefined,
        search: search.trim() || undefined,
      };
      const res = await api.get('/admin/chat/conversations', { params });
      setConversations(res.data.conversations || []);
    } catch (err) {
      console.error('[MONITORING] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConversations(true);
  }, [filterType]);

  const handleSearch = () => {
    fetchConversations(true);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConversations(false);
  };

  const renderItem = ({ item }) => {
    let title = item.name || 'Group Chat';
    let subtitle = '';

    if (item.type === 'direct') {
      const other = item.participants.find((p) => p._id !== user?._id);
      title = other?.name || 'Unknown User';
      subtitle = `1-to-1 (${other?.role || 'user'})`;
    } else {
      subtitle = `${item.participants.length} participants`;
    }

    const formattedTime = item.lastActivityAt
      ? new Date(item.lastActivityAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <TouchableOpacity
        style={styles.item}
        activeOpacity={0.75}
        onPress={() => {
          navigation.navigate('AdminChatMonitoringRoom', {
            conversationId: item._id,
            title,
          });
        }}
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: item.type === 'direct' ? '#38bdf822' : '#8b5cf622' }]}>
            <Text style={[styles.avatarText, { color: item.type === 'direct' ? '#38bdf8' : '#8b5cf6' }]}>
              {title[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.row}>
            <View style={styles.titleRow}>
              <Text style={styles.name} numberOfLines={1}>
                {title}
              </Text>
              {item.isParticipant && (
                <View style={styles.participantBadge}>
                  <Text style={styles.participantBadgeText}>Joined</Text>
                </View>
              )}
            </View>
            <Text style={styles.time}>{formattedTime}</Text>
          </View>

          <Text style={styles.subtitle}>{subtitle}</Text>

          <Text style={styles.preview} numberOfLines={1}>
            {item.lastMessage?.content || 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monitor Chats</Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or group name..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabRow}>
        {['all', 'direct', 'group'].map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, filterType === t && styles.activeTab]}
            onPress={() => setFilterType(t)}
          >
            <Text style={[styles.tabText, filterType === t && styles.activeTabText]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#38bdf8" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No conversations found.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
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
  backText: { color: '#38bdf8', fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#f8fafc' },
  searchRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#f8fafc',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchBtn: {
    backgroundColor: '#38bdf8',
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  searchBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    paddingBottom: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeTab: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  tabText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  activeTabText: { color: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 15 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  avatarContainer: { position: 'relative' },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800' },
  details: { flex: 1, marginLeft: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#f8fafc', maxWidth: '75%' },
  participantBadge: {
    backgroundColor: '#22c55e22',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  participantBadgeText: { color: '#22c55e', fontSize: 9, fontWeight: '800' },
  time: { fontSize: 11, color: '#64748b' },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  preview: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
});
