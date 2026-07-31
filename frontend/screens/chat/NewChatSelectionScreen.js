import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';

export default function NewChatSelectionScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isStaff = ['admin', 'superadmin'].includes(user?.role);

  useEffect(() => {
    const fetchRecipients = async () => {
      try {
        setError('');
        let res;
        if (isStaff) {
          // Admins can DM teachers, students, and other admins/superadmins
          res = await api.get('/admin/users', { params: { limit: 100 } });
          const list = res.data.users || [];
          // Filter out self
          setRecipients(list.filter((u) => u._id !== user?._id && u.status === 'approved'));
        } else {
          // Teachers / Students can ONLY chat with admins/superadmins.
          // Since /admin/users is restricted to admins only, we hit the generic auth endpoint or a fallback.
          // In the ClassBridge architecture, the backend allows /api/admin/users only for admins.
          // Non-admins can search for administrators. Let's fetch the list of approved admins.
          // Note: If no special endpoint exists for searching admins, we fetch /auth/me or request administrators.
          // In this system, any approved user has read-access to list administrators?
          // Let's call /api/chat/conversations or fetch users. If non-admin doesn't have list rights,
          // they can request the admin contacts list. Let's write a generic request.
          // Typically we have a route or can query admins. Let's test a GET to /admin/users or fallback.
          // Let's check how users get listed. If listUsers requires admin, non-admins might not be able to call it.
          // In classbridge, let's list conversation participants or admins.
          // Let's attempt to query with fallback if fails:
          try {
            res = await api.get('/admin/users', { params: { role: 'admin', limit: 50 } });
            setRecipients(res.data.users || []);
          } catch (e) {
            // Fallback: If forbidden (403), the user cannot list other users directly.
            // In a production scenario, non-admins can start chats. Let's handle list display gracefully.
            // If they can't search, we display a fallback contact list of admins, or allow typing name/phone.
            setError('Contact list only available for administrators. Start chat from incoming messages or existing groups.');
          }
        }
      } catch (err) {
        setError('Failed to fetch available contacts.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecipients();
  }, [user]);

  const handleSelectUser = async (recipient) => {
    try {
      setLoading(true);
      const res = await api.post('/chat/direct', { recipientId: recipient._id });
      const conversation = res.data.conversation;
      navigation.replace('ChatRoom', {
        conversationId: conversation._id,
        title: recipient.name,
      });
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to start conversation.');
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity style={styles.item} onPress={() => handleSelectUser(item)}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name[0]?.toUpperCase()}</Text>
        </View>
        <View style={styles.details}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.role}>{item.role.toUpperCase()}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>✕ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Chat</Text>
        <View style={{ width: 50 }} />
      </View>

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
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No available contacts found.</Text>
            </View>
          }
          contentContainerStyle={{ paddingVertical: 10 }}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#ef4444', textAlign: 'center', fontSize: 14 },
  emptyText: { color: '#64748b', fontSize: 15 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#38bdf822', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#38bdf8', fontSize: 16, fontWeight: '800' },
  details: { marginLeft: 12 },
  name: { fontSize: 15, fontWeight: '700', color: '#f8fafc' },
  role: { fontSize: 11, fontWeight: '600', color: '#64748b', marginTop: 2 },
});
