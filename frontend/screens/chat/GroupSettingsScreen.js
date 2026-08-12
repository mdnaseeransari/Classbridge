import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import Avatar from '../../components/ui/Avatar';
import RoleBadge from '../../components/ui/RoleBadge';
import LoadingScreen from '../../components/ui/LoadingScreen';

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
    } catch (_err) {
      // silent fail
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users', { params: { limit: 100 } });
      const list = res.data.users || [];
      if (group) {
        const participantIds = new Set(group.participants.map((p) => p._id));
        const filtered = list.filter((u) => u.status === 'approved' && !u.isBanned && !participantIds.has(u._id));
        setUsers(filtered);
      }
    } catch (_err) {
      // silent fail
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
      await fetchGroupDetail();
    } catch (_err) {
      // silent fail
    } finally {
      setUpdating(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (Platform.OS === 'web') {
      const confirm = window.confirm('Are you sure you want to remove this user from the group?');
      if (!confirm) return;
      try {
        await api.delete(`/chat/groups/${conversationId}/members/${userId}`);
        await fetchGroupDetail();
      } catch (_err) {
        // silent fail
      }
      return;
    }

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
              await fetchGroupDetail();
            } catch (_err) {
              // silent fail
            }
          },
        },
      ]
    );
  };

  const handleAddMember = async (userId) => {
    try {
      await api.post(`/chat/groups/${conversationId}/members`, { userIds: [userId] });
      await fetchGroupDetail();
    } catch (_err) {
      // silent fail
    }
  };

  const handleGenerateInvite = async () => {
    try {
      const res = await api.post(`/chat/groups/${conversationId}/invites`, {
        expiresHours: expiresHours ? parseInt(expiresHours, 10) : undefined,
        maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
      });
      setInviteCode(res.data.invite.code);
    } catch (_err) {
      // silent fail
    }
  };

  const handleDeleteGroup = async () => {
    if (Platform.OS === 'web') {
      const confirm = window.confirm('Are you sure you want to delete this group permanently?');
      if (!confirm) return;
      try {
        await api.delete(`/chat/groups/${conversationId}`);
        navigation.getParent()?.getParent()?.navigate('AdminTabs') ?? 
        navigation.getParent()?.navigate('AdminTabs');
      } catch (_err) {
        // silent fail
      }
      return;
    }

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
              navigation.getParent()?.getParent()?.navigate('AdminTabs') ?? 
              navigation.getParent()?.navigate('AdminTabs');
            } catch (_err) {
              // silent fail
            }
          },
        },
      ]
    );
  };

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#17212b" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.body}>
          {/* Inline editable name */}
          <View style={styles.nameCard}>
            <Avatar name={group?.name || 'Group'} role="admin" size="large" />
            <View style={styles.nameInputRow}>
              <TextInput
                style={styles.nameInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Group name"
                placeholderTextColor="#708499"
              />
              <TouchableOpacity onPress={handleRename} disabled={updating}>
                {updating ? (
                  <ActivityIndicator size="small" color="#5288c1" />
                ) : (
                  <Ionicons name="checkmark" size={24} color="#5288c1" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Members section */}
          <Text style={styles.sectionHeader}>MEMBERS ({group?.participants?.length || 0})</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.addMemberRow}
              onPress={() => setShowAddSection(!showAddSection)}
              activeOpacity={0.8}
            >
              <Ionicons name="person-add-outline" size={20} color="#5288c1" />
              <Text style={styles.addMemberText}>{showAddSection ? 'Hide Contact List' : 'Add Member'}</Text>
            </TouchableOpacity>

            {showAddSection && (
              <View style={styles.addSection}>
                {users.map((u) => (
                  <View key={u._id} style={styles.userRow}>
                    <Avatar name={u.name} role={u.role} size="small" />
                    <Text style={styles.userName}>{u.name}</Text>
                    <TouchableOpacity style={styles.addBtn} onPress={() => handleAddMember(u._id)}>
                      <Text style={styles.addBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {users.length === 0 && <Text style={styles.emptyLabel}>No available contacts to add.</Text>}
              </View>
            )}

            {group?.participants?.map((p) => {
              const isCreator = String(p._id) === String(group.createdBy);
              return (
                <View key={p._id} style={styles.userRow}>
                  <Avatar name={p.name} role={p.role} size="small" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.userName}>{p.name}</Text>
                    <View style={{ marginTop: 2 }}>
                      <RoleBadge role={p.role} />
                    </View>
                  </View>

                  {!isCreator && (
                    <TouchableOpacity onPress={() => handleRemoveMember(p._id)}>
                      <Text style={styles.removeText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* Generate Invite Code */}
          <Text style={styles.sectionHeader}>INVITE LINK</Text>
          <View style={styles.card}>
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

            <TouchableOpacity style={styles.inviteBtn} onPress={handleGenerateInvite} activeOpacity={0.8}>
              <Text style={styles.inviteBtnText}>Create Invite Link</Text>
            </TouchableOpacity>

            {inviteCode ? (
              <View style={styles.codeDisplay}>
                <Text style={styles.codeLabel}>Code:</Text>
                <Text style={styles.codeText}>{inviteCode}</Text>
              </View>
            ) : null}
          </View>

          {/* Delete Group */}
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteGroup} activeOpacity={0.8}>
            <Text style={styles.deleteBtnText}>Delete Group</Text>
          </TouchableOpacity>
        </ScrollView>
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
  body: {
    paddingBottom: 40,
  },
  nameCard: {
    backgroundColor: '#17212b',
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  nameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  nameInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    backgroundColor: '#2b3a4b',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '500',
    color: '#708499',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  card: {
    backgroundColor: '#232e3c',
    borderRadius: 10,
    marginHorizontal: 16,
    paddingHorizontal: 16,
  },
  addMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  addMemberText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#5288c1',
  },
  addSection: {
    backgroundColor: '#2b3a4b',
    borderRadius: 10,
    padding: 12,
    marginVertical: 12,
  },
  userRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  addBtn: {
    backgroundColor: '#4dbd74',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  removeText: {
    color: '#e53935',
    fontSize: 14,
    fontWeight: '500',
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
  },
  miniLabel: {
    fontSize: 12,
    color: '#708499',
    marginBottom: 4,
  },
  miniInput: {
    backgroundColor: '#2b3a4b',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    color: '#ffffff',
    fontSize: 14,
  },
  inviteBtn: {
    backgroundColor: '#5288c1',
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
  },
  inviteBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  codeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2b3a4b',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  codeLabel: {
    color: '#708499',
    fontSize: 13,
  },
  codeText: {
    color: '#5288c1',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteBtn: {
    marginHorizontal: 16,
    marginTop: 32,
    alignItems: 'center',
    paddingVertical: 14,
  },
  deleteBtnText: {
    color: '#e53935',
    fontSize: 15,
    fontWeight: '500',
  },
  emptyLabel: {
    color: '#708499',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
