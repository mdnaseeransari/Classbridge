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
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import * as adminApi from '../../services/adminApi';

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
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to fetch user details.');
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchUserDetail().finally(() => setLoading(false));
  }, [userId]);

  const handleToggleBan = async () => {
    if (!user) return;
    const actionText = user.isBanned ? 'unban' : 'ban';
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
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.error || `Failed to ${actionText} user.`);
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
      Alert.alert('Success', 'User account unlocked successfully.');
      await fetchUserDetail();
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to unlock user.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
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
              Alert.alert('Success', 'User deleted successfully.');
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to delete user.');
            } finally {
              setActionLoading(false);
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

  if (error || !user) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'User not found.'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showUnlockBtn = user.isLocked || (user.loginAttempts && user.loginAttempts >= 5);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.roleText}>{user.role.toUpperCase()}</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone:</Text>
            <Text style={styles.infoValue}>{user.phone || '—'}</Text>
          </View>
          {user.email ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={[styles.infoValue, { textTransform: 'capitalize' }]}>{user.status}</Text>
          </View>

          {user.subject ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Subject:</Text>
              <Text style={styles.infoValue}>{user.subject}</Text>
            </View>
          ) : user.classGrade ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Class/Grade:</Text>
              <Text style={styles.infoValue}>{user.classGrade}</Text>
            </View>
          ) : null}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Lock Status:</Text>
            <Text style={styles.infoValue}>{user.isLocked ? 'Locked 🔒' : 'Active 🔓'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Banned:</Text>
            <Text style={[styles.infoValue, user.isBanned && { color: '#ef4444' }]}>
              {user.isBanned ? 'Yes 🚫' : 'No'}
            </Text>
          </View>
        </View>

        {/* Note Box */}
        <View style={styles.noteContainer}>
          <Text style={styles.noteTitle}>Action Note (Stored in audit log)</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Type reason here..."
            placeholderTextColor="#475569"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Action Section */}
        <View style={styles.actions}>
          {actionLoading && <ActivityIndicator color="#38bdf8" style={{ marginBottom: 12 }} />}

          <TouchableOpacity
            style={[styles.btn, user.isBanned ? styles.unbanBtn : styles.banBtn]}
            onPress={handleToggleBan}
            disabled={actionLoading}
          >
            <Text style={styles.btnText}>{user.isBanned ? 'Unban User' : 'Ban User'}</Text>
          </TouchableOpacity>

          {showUnlockBtn && (
            <TouchableOpacity
              style={[styles.btn, styles.unlockBtn]}
              onPress={handleUnlock}
              disabled={actionLoading}
            >
              <Text style={styles.btnText}>Unlock Account</Text>
            </TouchableOpacity>
          )}

          {isSuperAdmin && (
            <TouchableOpacity
              style={[styles.btn, styles.promoteBtn]}
              onPress={() => navigation.navigate('PromoteToAdmin', { user })}
              disabled={actionLoading}
            >
              <Text style={styles.btnText}>Promote to Admin</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.btn, styles.deleteBtn]}
            onPress={handleDelete}
            disabled={actionLoading}
          >
            <Text style={styles.btnText}>Delete User Account</Text>
          </TouchableOpacity>
        </View>
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
  errorText: { color: '#ef4444', fontSize: 16, marginBottom: 16 },
  backButton: { backgroundColor: '#1e293b', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  backButtonText: { color: '#f8fafc', fontWeight: '600' },
  body: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  name: { fontSize: 20, fontWeight: '800', color: '#f8fafc' },
  roleText: { fontSize: 12, fontWeight: '700', color: '#38bdf8', marginTop: 4, marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
  infoLabel: { color: '#64748b', fontSize: 14 },
  infoValue: { color: '#f8fafc', fontSize: 14, fontWeight: '600' },
  noteContainer: { marginBottom: 20 },
  noteTitle: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 },
  noteInput: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    color: '#f8fafc',
    fontSize: 14,
    minHeight: 60,
  },
  actions: { gap: 10 },
  btn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  banBtn: { backgroundColor: '#ea580c' },
  unbanBtn: { backgroundColor: '#16a34a' },
  unlockBtn: { backgroundColor: '#2563eb' },
  promoteBtn: { backgroundColor: '#8b5cf6' },
  deleteBtn: { backgroundColor: '#dc2626' },
});
