import React, { useContext, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import { COLORS, SPACING, RADIUS } from '../../theme';

export default function SettingsScreen({ navigation }) {
  const { user, logout, setUser } = useContext(AuthContext);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [muteNotifications, setMuteNotifications] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [oldCredential, setOldCredential] = useState('');
  const [newCredential, setNewCredential] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [securitySuccess, setSecuritySuccess] = useState('');

  const getRoleColors = (role) => {
    switch (role) {
      case 'superadmin':
        return ['#8b5cf6', '#a78bfa'];
      case 'admin':
        return ['#2563eb', '#3b82f6'];
      case 'teacher':
        return ['#10b981', '#34d399'];
      default:
        return ['#f59e0b', '#fbbf24'];
    }
  };

  const roleColors = getRoleColors(user?.role);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.patch('/auth/profile', {
        name: name.trim(),
        phone: phone.trim(),
      });
      if (res.data.user) {
        setUser((prev) => ({
          ...prev,
          name: res.data.user.name,
          phone: res.data.user.phone,
        }));
      }
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldCredential || !newCredential) {
      setSecurityError('Both current and new credentials are required.');
      return;
    }
    setChangingPassword(true);
    setSecurityError('');
    setSecuritySuccess('');
    try {
      await api.patch('/auth/change-password', {
        oldCredential: oldCredential.trim(),
        newCredential: newCredential.trim(),
      });
      setSecuritySuccess('Credentials updated successfully.');
      setOldCredential('');
      setNewCredential('');
    } catch (err) {
      setSecurityError(err?.response?.data?.error || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />
      
      {/* Header */}
      <View style={styles.header}>
        {navigation.canGoBack() ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="arrow-back" size={20} color="#2563eb" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: roleColors[0] }]}>
            <Text style={styles.avatarText}>{user?.name[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.profileName}>{user?.name}</Text>
          <Text style={styles.profileRole}>{user?.role?.toUpperCase()}</Text>
        </View>

        {/* Form */}
        <Text style={styles.sectionTitle}>Profile Details</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor="#64748b"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor="#64748b"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user?.email || 'N/A'}</Text>
        </View>

        {user?.subject && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Subject</Text>
            <Text style={styles.infoValue}>{user.subject}</Text>
          </View>
        )}

        {/* Notifications & Toggles */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleTitle}>Mute Notifications</Text>
            <Text style={styles.toggleDesc}>Temporarily silence app alerts</Text>
          </View>
          <Switch
            value={muteNotifications}
            onValueChange={setMuteNotifications}
            trackColor={{ false: '#1e293b', true: '#2563eb' }}
            thumbColor={muteNotifications ? '#ffffff' : '#64748b'}
          />
        </View>

        {/* Security / Password reset */}
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.securityBox}>
          <Text style={styles.label}>
            {['teacher', 'student'].includes(user?.role) ? 'Current 6-Digit PIN' : 'Current Password'}
          </Text>
          <TextInput
            style={styles.input}
            value={oldCredential}
            onChangeText={setOldCredential}
            placeholder={['teacher', 'student'].includes(user?.role) ? '123456' : '••••••••'}
            placeholderTextColor="#64748b"
            secureTextEntry={!['teacher', 'student'].includes(user?.role)}
            keyboardType={['teacher', 'student'].includes(user?.role) ? 'numeric' : 'default'}
          />

          <View style={{ height: 12 }} />

          <Text style={styles.label}>
            {['teacher', 'student'].includes(user?.role) ? 'New 6-Digit PIN' : 'New Password'}
          </Text>
          <TextInput
            style={styles.input}
            value={newCredential}
            onChangeText={setNewCredential}
            placeholder={['teacher', 'student'].includes(user?.role) ? '654321' : '••••••••'}
            placeholderTextColor="#64748b"
            secureTextEntry={!['teacher', 'student'].includes(user?.role)}
            keyboardType={['teacher', 'student'].includes(user?.role) ? 'numeric' : 'default'}
          />

          {securityError ? <Text style={[styles.errorText, { marginTop: 10, marginBottom: 0 }]}>{securityError}</Text> : null}
          {securitySuccess ? <Text style={[styles.successText, { marginTop: 10, marginBottom: 0 }]}>{securitySuccess}</Text> : null}

          <TouchableOpacity
            style={[styles.saveBtn, { marginTop: 16, backgroundColor: '#0284c7' }, changingPassword && { opacity: 0.6 }]}
            onPress={handleChangePassword}
            disabled={changingPassword}
          >
            {changingPassword ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Update Password/PIN</Text>}
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#f1f5f9' },
  body: { padding: 20, paddingBottom: 40 },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#ffffff' },
  profileName: { fontSize: 20, fontWeight: '800', color: '#f1f5f9' },
  profileRole: { fontSize: 12, fontWeight: '700', color: '#64748b', marginTop: 4, letterSpacing: 1 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 12,
  },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 12,
    color: '#f1f5f9',
    fontSize: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    marginBottom: 16,
  },
  infoLabel: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#f1f5f9', fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 24,
  },
  securityBox: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 24,
  },
  toggleTitle: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  toggleDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  saveBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#ef4444',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 8,
  },
  logoutBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
  errorText: { color: '#ef4444', marginBottom: 14, textAlign: 'center', fontSize: 14 },
  successText: { color: '#10b981', marginBottom: 14, textAlign: 'center', fontSize: 14 },
});
