import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import { COLORS, SPACING, RADIUS } from '../../theme';

// Role display config: label, avatar colour, text colour
const ROLE_META = {
  superadmin: { label: 'Super Admin', avatarBg: 'rgba(124, 58, 237, 0.1)', avatarText: '#a78bfa' },
  admin:      { label: 'Admin',       avatarBg: 'rgba(37, 99, 235, 0.1)', avatarText: '#2563eb' },
  teacher:    { label: 'Teacher',     avatarBg: 'rgba(16, 185, 129, 0.1)', avatarText: '#10b981' },
  student:    { label: 'Student',     avatarBg: 'rgba(245, 158, 11, 0.1)', avatarText: '#fbbf24' },
};

function getRoleMeta(role) {
  return ROLE_META[role] || { label: role, avatarBg: 'rgba(100, 116, 139, 0.1)', avatarText: '#64748b' };
}

export default function NewChatSelectionScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [allRecipients, setAllRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [starting, setStarting] = useState(null); // id of user being navigated to

  const isAdmin = ['admin', 'superadmin'].includes(user?.role);

  // ── Fetch contacts on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchRecipients = async () => {
      try {
        setError('');
        const res = await api.get('/chat/contacts');
        const list = res.data.users || [];
        setAllRecipients(list);
      } catch (err) {
        console.error('[NEW_CHAT] fetchRecipients error:', err);
        setError('Failed to fetch available contacts.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecipients();
  }, [user]);

  // ── Client-side search filter (name or role label) ──────────────────────────
  const recipients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRecipients;
    return allRecipients.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (ROLE_META[u.role]?.label || u.role).toLowerCase().includes(q)
    );
  }, [allRecipients, search]);

  // ── Start conversation ──────────────────────────────────────────────────────
  const handleSelectUser = async (recipient) => {
    if (starting) return; // prevent double-tap
    try {
      setStarting(recipient._id);
      setError('');
      const res = await api.post('/chat/direct', { recipientId: recipient._id });
      const conversation = res.data.conversation;
      navigation.replace('ChatRoom', {
        conversationId: conversation._id,
        title: recipient.name,
      });
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to start conversation.');
      setStarting(null);
    }
  };

  // ── Render one contact row ──────────────────────────────────────────────────
  const renderItem = ({ item }) => {
    const meta = getRoleMeta(item.role);
    const isStarting = starting === item._id;

    return (
      <TouchableOpacity
        style={styles.item}
        activeOpacity={0.75}
        disabled={!!starting}
        onPress={() => handleSelectUser(item)}
      >
        <View style={[styles.avatar, { backgroundColor: meta.avatarBg }]}>
          {isStarting ? (
            <ActivityIndicator size="small" color={meta.avatarText} />
          ) : (
            <Text style={[styles.avatarText, { color: meta.avatarText }]}>
              {item.name[0]?.toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.details}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={[styles.roleLabel, { color: meta.avatarText }]}>{meta.label}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  const listHeader = (
    <View style={styles.hint}>
      <Text style={styles.hintText}>
        {isAdmin
          ? 'Select anyone to start a direct message.'
          : user?.role === 'teacher'
          ? 'Select an Admin or another Teacher to message.'
          : 'Select an Admin or another Student to message.'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="close" size={18} color={COLORS.textSecondary} />
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Chat</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Search bar — only shown when list is ready */}
      {!loading && !error && (
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or role…"
            placeholderTextColor={COLORS.textSecondary}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={recipients}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {search.trim() ? `No contacts matching "${search.trim()}".` : 'No available contacts found.'}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
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
  backText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  searchRow: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  searchInput: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.button,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  hint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  hintText: { color: COLORS.textSecondary, fontSize: 12, fontStyle: 'italic' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: COLORS.danger, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '800' },
  details: { flex: 1, marginLeft: 13 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  roleLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  chevron: { color: COLORS.cardBorder, fontSize: 22, fontWeight: '300' },
});
