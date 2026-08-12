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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import Avatar from '../../components/ui/Avatar';
import RoleBadge from '../../components/ui/RoleBadge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingScreen from '../../components/ui/LoadingScreen';

export default function NewChatSelectionScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [allRecipients, setAllRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [starting, setStarting] = useState(null);

  const isAdmin = ['admin', 'superadmin'].includes(user?.role);

  useEffect(() => {
    const fetchRecipients = async () => {
      try {
        setError('');
        const res = await api.get('/chat/contacts');
        const list = res.data.users || [];
        setAllRecipients(list);
      } catch (_err) {
        setError('Failed to fetch available contacts.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecipients();
  }, [user]);

  const recipients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRecipients;
    return allRecipients.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [allRecipients, search]);

  const handleSelectUser = async (recipient) => {
    if (starting) return;
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

  const renderItem = ({ item }) => {
    const isStarting = starting === item._id;

    return (
      <TouchableOpacity
        style={styles.itemRow}
        activeOpacity={0.75}
        disabled={!!starting}
        onPress={() => handleSelectUser(item)}
      >
        <Avatar name={item.name} role={item.role} size="medium" />
        <View style={styles.details}>
          <Text style={styles.nameText}>{item.name}</Text>
          <View style={{ marginTop: 2 }}>
            <RoleBadge role={item.role} />
          </View>
        </View>
        {isStarting ? (
          <ActivityIndicator size="small" color="#5288c1" />
        ) : (
          <Ionicons name="chevron-forward" size={18} color="#708499" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#17212b" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Message</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.container}>
        {!loading && !error && (
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search contacts..."
              placeholderTextColor="#708499"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
          </View>
        )}

        {loading ? (
          <LoadingScreen />
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
              <EmptyState title="No contacts found" subtitle={search.trim() ? `No matches for "${search.trim()}".` : ''} />
            }
            contentContainerStyle={{ paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
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
  searchRow: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  searchInput: {
    backgroundColor: '#2b3a4b',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 44,
    color: '#ffffff',
    fontSize: 14,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#e53935',
    fontSize: 14,
    textAlign: 'center',
  },
  itemRow: {
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
  nameText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
