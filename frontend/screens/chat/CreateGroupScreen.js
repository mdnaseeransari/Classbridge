import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import api from '../../services/api';
import { COLORS, SPACING, RADIUS } from '../../theme';

export default function CreateGroupScreen({ navigation }) {
  const [groupName, setGroupName] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setError('');
        const res = await api.get('/admin/users', { params: { limit: 100 } });
        const list = res.data.users || [];
        const filtered = list.filter((u) => u.status === 'approved' && !u.isBanned);
        setUsers(filtered);
      } catch (err) {
        setError('Failed to fetch user list for selection.');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Validation Error', 'Group name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/chat/groups', {
        name: groupName.trim(),
        participantIds: Array.from(selectedIds),
      });
      const conversation = res.data.conversation;
      Alert.alert('Success', `Group "${conversation.name}" created successfully.`);
      navigation.replace('ChatRoom', {
        conversationId: conversation._id,
        title: conversation.name,
      });
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to create group.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }) => {
    const isSelected = selectedIds.has(item._id);
    return (
      <TouchableOpacity
        style={[styles.userRow, isSelected && styles.userRowSelected]}
        onPress={() => toggleSelect(item._id)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name[0]?.toUpperCase()}</Text>
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userRole}>{item.role.toUpperCase()}</Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Text style={styles.checkboxCheck}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Group</Text>
        <TouchableOpacity onPress={handleCreateGroup} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={COLORS.accent} />
          ) : (
            <Text style={styles.createText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.label}>Group Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Science Class 10A"
          placeholderTextColor={COLORS.textSecondary}
          value={groupName}
          onChangeText={setGroupName}
        />

        <Text style={styles.label}>Select Members ({selectedIds.size} selected)</Text>

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
            data={users}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>
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
  createText: { color: COLORS.accent, fontSize: 15, fontWeight: '700' },
  body: { flex: 1, padding: 16 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 14,
    color: COLORS.textPrimary,
    fontSize: 15,
    marginBottom: 16,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: COLORS.danger, textAlign: 'center' },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.card,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  userRowSelected: { borderColor: COLORS.accent, backgroundColor: 'rgba(37, 99, 235, 0.1)' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(37, 99, 235, 0.1)', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: COLORS.accent, fontSize: 14, fontWeight: '800' },
  userDetails: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  userRole: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary, marginTop: 2 },
  checkbox: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.textSecondary, justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  checkboxCheck: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
});
