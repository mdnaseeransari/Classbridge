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
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';

// Role display config: label, avatar colour, text colour
const ROLE_META = {
  superadmin: { label: 'Super Admin', avatarBg: '#7c3aed22', avatarText: '#a78bfa' },
  admin:      { label: 'Admin',       avatarBg: '#0ea5e922', avatarText: '#38bdf8' },
  teacher:    { label: 'Teacher',     avatarBg: '#10b98122', avatarText: '#34d399' },
  student:    { label: 'Student',     avatarBg: '#f59e0b22', avatarText: '#fbbf24' },
};

function getRoleMeta(role) {
  return ROLE_META[role] || { label: role, avatarBg: '#64748b22', avatarText: '#94a3b8' };
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

        if (isAdmin) {
          // Admins can DM any approved, non-banned user of any role —
          // including other Admins and Super Admins.
          // /admin/users returns all roles; we filter out self + banned + non-approved client-side.
          const res = await api.get('/admin/users', { params: { limit: 200 } });
          const list = res.data.users || [];

          const eligible = list.filter(
            (u) =>
              u._id !== user?._id &&       // not self
              u.status === 'approved' &&    // must be approved
              !u.isBanned                   // must not be banned
          );

          // Sort: admins/superadmins first, then teachers, then students — all alpha within group
          const roleOrder = { superadmin: 0, admin: 1, teacher: 2, student: 3 };
          eligible.sort((a, b) => {
            const ro = (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
            return ro !== 0 ? ro : a.name.localeCompare(b.name);
          });

          setAllRecipients(eligible);
        } else {
          // Teachers and Students can only DM Admins and Super Admins.
          // We call our public /chat/admins endpoint which retrieves approved admins/superadmins.
          const res = await api.get('/chat/admins');
          const list = res.data.users || [];

          // Sort by name
          list.sort((a, b) => a.name.localeCompare(b.name));

          if (list.length === 0) {
            setError('No administrator contacts are available right now.');
          } else {
            setAllRecipients(list);
          }
        }
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

  // ── Section header injected via ListHeaderComponent ─────────────────────────
  // Shows a brief hint about who can be messaged
  const listHeader = (
    <View style={styles.hint}>
      <Text style={styles.hintText}>
        {isAdmin
          ? 'Select anyone to start a direct message.'
          : 'You can only message Admins and Super Admins.'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>✕ Cancel</Text>
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
            placeholderTextColor="#475569"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#38bdf8" />
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
  backText: { color: '#64748b', fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#f8fafc' },

  searchRow: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  searchInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: '#f8fafc',
    fontSize: 14,
  },

  hint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  hintText: { color: '#475569', fontSize: 12, fontStyle: 'italic' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#ef4444', textAlign: 'center', fontSize: 14, lineHeight: 20 },
  emptyText: { color: '#64748b', fontSize: 15, textAlign: 'center' },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
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
  name: { fontSize: 15, fontWeight: '700', color: '#f8fafc' },
  roleLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  chevron: { color: '#334155', fontSize: 22, fontWeight: '300' },
});
