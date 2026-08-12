import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import Avatar from '../../components/ui/Avatar';
import RoleBadge from '../../components/ui/RoleBadge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingScreen from '../../components/ui/LoadingScreen';

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
      } catch (_err) {
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
    if (!groupName.trim()) return;

    setSubmitting(true);
    try {
      const res = await api.post('/chat/groups', {
        name: groupName.trim(),
        participantIds: Array.from(selectedIds),
      });
      const conversation = res.data.conversation;
      navigation.replace('ChatRoom', {
        conversationId: conversation._id,
        title: conversation.name,
      });
    } catch (_err) {
      // silent fail
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }) => {
    const isSelected = selectedIds.has(item._id);
    return (
      <TouchableOpacity
        style={styles.memberRow}
        onPress={() => toggleSelect(item._id)}
        activeOpacity={0.75}
      >
        <Avatar name={item.name} role={item.role} size="medium" />

        <View style={styles.details}>
          <Text style={styles.nameText}>{item.name}</Text>
          <View style={{ marginTop: 2 }}>
            <RoleBadge role={item.role} />
          </View>
        </View>

        <View style={[styles.circleCheck, isSelected && styles.circleCheckActive]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#ffffff" />}
        </View>
      </TouchableOpacity>
    );
  };

  const canCreate = groupName.trim().length > 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#17212b" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Group</Text>
        <TouchableOpacity onPress={handleCreateGroup} disabled={!canCreate || submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color="#5288c1" />
          ) : (
            <Text style={[styles.createText, !canCreate && styles.createTextDisabled]}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <View style={{ padding: 16 }}>
          <TextInput
            style={styles.input}
            placeholder="Group name..."
            placeholderTextColor="#708499"
            value={groupName}
            onChangeText={setGroupName}
          />
        </View>

        <Text style={styles.sectionLabel}>MEMBERS ({selectedIds.size})</Text>

        {loading ? (
          <LoadingScreen />
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            ListEmptyComponent={<EmptyState title="No members available" />}
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
  cancelText: {
    color: '#708499',
    fontSize: 15,
    fontWeight: '400',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  createText: {
    color: '#5288c1',
    fontSize: 15,
    fontWeight: '600',
  },
  createTextDisabled: {
    color: '#708499',
  },
  input: {
    backgroundColor: '#2b3a4b',
    borderRadius: 10,
    height: 52,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#708499',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginHorizontal: 16,
    marginBottom: 8,
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
  },
  memberRow: {
    height: 56,
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
  circleCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#0e1621',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleCheckActive: {
    borderColor: '#5288c1',
    backgroundColor: '#5288c1',
  },
});
