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
  ScrollView,
  StatusBar,
} from 'react-native';
import api from '../../services/api';

export default function GroupSettingsScreen({ route, navigation }) {
  const { conversationId } = route.params;

  const [group, setGroup] = useState(null);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [users, setUsers] = useState([]);
  const [showAddSection, setShowAddSection] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [expiresHours, setExpiresHours] = useState('24');
  const [maxUses, setMaxUses] = useState('50');

  const fetchGroupDetail = async () => {
    try {
      const res = await api.get(`/chat/conversations/${conversationId}`);
      const fetched = res.data.conversation;
      setGroup(fetched);
      setNewName(fetched.name);
    } catch (err) {
      console.error('[SETTINGS] Error fetching group detail:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users', { params: { limit: 100 } });
      const list = res.data.users || [];
      // Select users who are approved, not banned, and not already in the group
      if (group) {
        const participantIds = new Set(group.participants.map((p) => p._id));
        const filtered = list.filter((u) => u.status === 'approved' && !u.isBanned && !participantIds.has(u._id));
        setUsers(filtered);
      }
    } catch (err) {
      console.error('[SETTINGS] Error listing users:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchGroupDetail().finally(() => setLoading(false));
  }, [conversationId]);

  useEffect(() => {
    if (showAddSection) {
      fetchUsers();
    }
  }, [showAddSection, group]);

  const handleRename = async () => {
    if (!newName.trim()) return;
    setUpdating(true);
    try {
      await api.patch(`/chat/groups/${conversationId}`, { name: newName.trim() });
      Alert.alert('Success', 'Group renamed successfully.');
      await fetchGroupDetail();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to rename group.');
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this user from the group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/chat/groups/${conversationId}/members/${userId}`);
              Alert.alert('Success', 'Member removed.');
              await fetchGroupDetail();
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to remove member.');
            }
          },
        },
      ]
    );
  };

  const handleAddMember = async (userId) => {
    try {
      await api.post(`/chat/groups/${conversationId}/members`, { userIds: [userId] });
      Alert.alert('Success', 'Member added.');
      await fetchGroupDetail();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to add member.');
    }
  };

  const handleGenerateInvite = async () => {
    try {
      const res = await api.post(`/chat/groups/${conversationId}/invites`, {
        expiresHours: expiresHours ? parseInt(expiresHours, 10) : undefined,
        maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
      });
      setInviteCode(res.data.invite.code);
      Alert.alert('Invite Link Generated', `Code: ${res.data.invite.code}`);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to generate invite link.');
    }
  };

  const handleDeleteGroup = async () => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group permanently? This will delete all chat history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/chat/groups/${conversationId}`);
              Alert.alert('Success', 'Group deleted.');
              navigation.navigate('UserTabs', { screen: 'Chat' });
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to delete group.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Rename Card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Group Name</Text>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder="Name"
            placeholderTextColor="#475569"
          />
          <TouchableOpacity style={styles.btn} onPress={handleRename} disabled={updating}>
            <Text style={styles.btnText}>Save Name</Text>
          </TouchableOpacity>
        </View>

        {/* Generate Invite Code */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Generate Invite Link</Text>
          <View style={styles.rowInputs}>
            <View style={{ flex: 1 }}>
              <Text style={styles.miniLabel}>Expiry (hours)</Text>
              <TextInput
                style={styles.miniInput}
                value={expiresHours}
                onChangeText={setExpiresHours}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.miniLabel}>Max Uses</Text>
              <TextInput
                style={styles.miniInput}
                value={maxUses}
                onChangeText={setMaxUses}
                keyboardType="numeric"
              />
            </View>
          </View>
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#8b5cf6' }]} onPress={handleGenerateInvite}>
            <Text style={styles.btnText}>Create Invite Link</Text>
          </TouchableOpacity>
          {inviteCode ? (
            <View style={styles.codeDisplay}>
              <Text style={styles.codeLabel}>Invite Code:</Text>
              <Text style={styles.codeText} selectTextOnFocus>{inviteCode}</Text>
            </View>
          ) : null}
        </View>

        {/* Members Management */}
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <Text style={styles.sectionLabel}>Current Members ({group?.participants?.length})</Text>
            <TouchableOpacity onPress={() => setShowAddSection(!showAddSection)}>
              <Text style={styles.addToggleLink}>{showAddSection ? 'Done' : '＋ Add Member'}</Text>
            </TouchableOpacity>
          </View>

          {showAddSection ? (
            <View style={styles.addSection}>
              <Text style={styles.miniLabel}>Select approved user to add:</Text>
              {users.map((u) => (
                <View key={u._id} style={styles.userItem}>
                  <View>
                    <Text style={styles.userName}>{u.name}</Text>
                    <Text style={styles.userRole}>{u.role.toUpperCase()}</Text>
                  </View>
                  <TouchableOpacity style={styles.miniAddBtn} onPress={() => handleAddMember(u._id)}>
                    <Text style={styles.miniAddText}>Add</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {users.length === 0 && <Text style={styles.emptyLabel}>No available contacts to add.</Text>}
            </View>
          ) : null}

          {group?.participants?.map((p) => {
            const isCreator = p._id === group.createdBy;
            return (
              <View key={p._id} style={styles.userItem}>
                <View>
                  <Text style={styles.userName}>{p.name}</Text>
                  <Text style={styles.userRole}>{p.role.toUpperCase()} {isCreator && '· CREATOR'}</Text>
                </View>
                {p._id !== group.createdBy && p._id !== group.groupAdmin && (
                  <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveMember(p._id)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* Delete Group */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteGroup}>
          <Text style={styles.deleteBtnText}>Delete Group permanently</Text>
        </TouchableOpacity>
      </ScrollView>
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
  backText: { color: '#38bdf8', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  body: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 12 },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    color: '#f8fafc',
    fontSize: 15,
    marginBottom: 12,
  },
  btn: { backgroundColor: '#38bdf8', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#0f172a', fontWeight: '700', fontSize: 14 },
  rowInputs: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  miniLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', marginBottom: 4 },
  miniInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
    color: '#f8fafc',
    fontSize: 14,
  },
  codeDisplay: {
    marginTop: 12,
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codeLabel: { color: '#64748b', fontSize: 13 },
  codeText: { color: '#38bdf8', fontSize: 16, fontWeight: '800' },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addToggleLink: { color: '#38bdf8', fontWeight: '700', fontSize: 13 },
  addSection: { backgroundColor: '#0f172a', padding: 12, borderRadius: 8, marginBottom: 12 },
  userItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  userName: { color: '#f8fafc', fontSize: 14, fontWeight: '600' },
  userRole: { color: '#64748b', fontSize: 11, marginTop: 2 },
  miniAddBtn: { backgroundColor: '#34d399', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6 },
  miniAddText: { color: '#0f172a', fontWeight: '700', fontSize: 12 },
  removeBtn: { backgroundColor: 'rgba(239,68,68,0.15)', borderColor: '#ef4444', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  removeText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
  deleteBtn: { backgroundColor: '#dc2626', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  deleteBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  emptyLabel: { color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 8 },
});
