import React, { useState, useEffect, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';
import Avatar from '../../components/ui/Avatar';
import RoleBadge from '../../components/ui/RoleBadge';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingScreen from '../../components/ui/LoadingScreen';

export default function UserDetailScreen({ route, navigation }) {
  const { userId } = route.params;
  const { user: currentUser } = useContext(AuthContext);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const isSuperAdmin = currentUser?.role === 'superadmin';

  const fetchUserDetail = async () => {
    try {
      setError('');
      const res = await adminApi.getUser(userId);
      setUser(res.data.user);
    } catch (_err) {
      setError('Failed to fetch user details.');
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchUserDetail().finally(() => setLoading(false));
  }, [userId]);

  const handleToggleBan = async () => {
    if (!user) return;
    const actionText = user.isBanned ? 'unban' : 'ban';
    
    if (Platform.OS === 'web') {
      const confirm = window.confirm(`Are you sure you want to ${actionText} this user?`);
      if (!confirm) return;
      setActionLoading(true);
      try {
        if (user.isBanned) {
          await adminApi.unbanUser(userId, note);
        } else {
          await adminApi.banUser(userId, note);
        }
        setNote('');
        await fetchUserDetail();
      } catch (_err) {
        // silent fail
      } finally {
        setActionLoading(false);
      }
      return;
    }

    Alert.alert(
      `${actionText.toUpperCase()} User`,
      `Are you sure you want to ${actionText} this user?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText.charAt(0).toUpperCase() + actionText.slice(1),
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              if (user.isBanned) {
                await adminApi.unbanUser(userId, note);
              } else {
                await adminApi.banUser(userId, note);
              }
              setNote('');
              await fetchUserDetail();
            } catch (_err) {
              // silent fail
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleUnlock = async () => {
    setActionLoading(true);
    try {
      await adminApi.unlockUser(userId, note);
      setNote('');
      await fetchUserDetail();
    } catch (_err) {
      // silent fail
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (Platform.OS === 'web') {
      const confirm = window.confirm('This action is irreversible and will permanently delete the user account. Proceed?');
      if (!confirm) return;
      setActionLoading(true);
      try {
        await adminApi.deleteUser(userId, note);
        navigation.goBack();
      } catch (_err) {
        // silent fail
      } finally {
        setActionLoading(false);
      }
      return;
    }

    Alert.alert(
      'Delete User',
      'This action is irreversible and will permanently delete the user account. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await adminApi.deleteUser(userId, note);
              navigation.goBack();
            } catch (_err) {
              // silent fail
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) return <LoadingScreen />;

  if (error || !user) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'User not found.'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showUnlockBtn = user.isLocked || (user.failedLoginAttempts && user.failedLoginAttempts >= 5);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#17212b" />

      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.body}>
          {/* Profile Header Banner */}
          <View style={styles.profileHeader}>
            <TouchableOpacity style={styles.backIcon} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>

            <Avatar name={user.name} role={user.role} size="large" />
            <Text style={styles.profileName}>{user.name}</Text>
            
            <View style={styles.badgesRow}>
              <RoleBadge role={user.role} />
              <StatusBadge status={user.isBanned ? 'banned' : user.status} />
            </View>
          </View>

          {/* Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>USER INFORMATION</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone Number</Text>
              <Text style={styles.infoValue}>{user.phone || '—'}</Text>
            </View>
            
            {user.email ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user.email}</Text>
              </View>
            ) : null}

            {user.subject ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Subject</Text>
                <Text style={styles.infoValue}>{user.subject}</Text>
              </View>
            ) : user.classGrade ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Class / Grade</Text>
                <Text style={styles.infoValue}>{user.classGrade}</Text>
              </View>
            ) : null}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Lock Status</Text>
              <Text style={styles.infoValue}>{user.isLocked ? 'Locked 🔒' : 'Active 🔓'}</Text>
            </View>
          </View>

          {/* Note Input */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>ACTION NOTE (AUDIT LOG)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Reason for audit log..."
              placeholderTextColor="#708499"
              value={note}
              onChangeText={setNote}
            />
          </View>

          {/* Actions Card */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>ADMINISTRATIVE ACTIONS</Text>

            {actionLoading && <ActivityIndicator color="#5288c1" style={{ marginBottom: 12 }} />}

            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleToggleBan}
              disabled={actionLoading}
            >
              <Ionicons
                name={user.isBanned ? 'checkmark-circle-outline' : 'ban-outline'}
                size={20}
                color={user.isBanned ? '#4dbd74' : '#e53935'}
              />
              <Text style={[styles.actionRowText, { color: user.isBanned ? '#4dbd74' : '#e53935' }]}>
                {user.isBanned ? 'Unban User' : 'Ban User'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#708499" />
            </TouchableOpacity>

            {showUnlockBtn && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleUnlock}
                disabled={actionLoading}
              >
                <Ionicons name="key-outline" size={20} color="#ffa726" />
                <Text style={[styles.actionRowText, { color: '#ffa726' }]}>Unlock Account</Text>
                <Ionicons name="chevron-forward" size={18} color="#708499" />
              </TouchableOpacity>
            )}

            {isSuperAdmin && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => navigation.navigate('PromoteToAdmin', { user })}
                disabled={actionLoading}
              >
                <Ionicons name="arrow-up-circle-outline" size={20} color="#5288c1" />
                <Text style={[styles.actionRowText, { color: '#5288c1' }]}>Promote to Admin</Text>
                <Ionicons name="chevron-forward" size={18} color="#708499" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionRow, { borderBottomWidth: 0 }]}
              onPress={handleDelete}
              disabled={actionLoading}
            >
              <Ionicons name="trash-outline" size={20} color="#e53935" />
              <Text style={[styles.actionRowText, { color: '#e53935' }]}>Delete Account</Text>
              <Ionicons name="chevron-forward" size={18} color="#708499" />
            </TouchableOpacity>
          </View>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#17212b',
    padding: 24,
  },
  errorText: {
    color: '#e53935',
    fontSize: 14,
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: '#2b3a4b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  body: {
    paddingBottom: 40,
  },
  profileHeader: {
    backgroundColor: '#17212b',
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  backIcon: {
    position: 'absolute',
    left: 16,
    top: 20,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#232e3c',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
  },
  cardSectionTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#708499',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  infoLabel: {
    color: '#708499',
    fontSize: 14,
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  noteInput: {
    backgroundColor: '#2b3a4b',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  actionRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
  },
});
