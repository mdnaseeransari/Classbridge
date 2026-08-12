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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import Avatar from '../../components/ui/Avatar';
import RoleBadge from '../../components/ui/RoleBadge';

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
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#17212b" />

      {/* Header */}
      <View style={styles.header}>
        {navigation.canGoBack() ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 8 }}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* Profile Banner */}
          <View style={styles.profileBanner}>
            <Avatar name={user?.name || 'User'} role={user?.role} size="large" />
            <Text style={styles.profileName}>{user?.name}</Text>
            <View style={{ marginTop: 6 }}>
              <RoleBadge role={user?.role} />
            </View>
          </View>

          {/* Profile Section */}
          <Text style={styles.sectionHeader}>PROFILE DETAILS</Text>
          <View style={styles.card}>
            <Text style={styles.label}>FULL NAME</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor="#708499"
            />

            <Text style={styles.label}>PHONE NUMBER</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor="#708499"
              keyboardType="phone-pad"
            />

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

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {success ? <Text style={styles.successText}>{success}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Save Profile Changes</Text>}
            </TouchableOpacity>
          </View>

          {/* Preferences Section */}
          <Text style={styles.sectionHeader}>PREFERENCES</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Mute Notifications</Text>
                <Text style={styles.toggleDesc}>Temporarily silence app alerts</Text>
              </View>
              <Switch
                value={muteNotifications}
                onValueChange={setMuteNotifications}
                trackColor={{ false: '#2b3a4b', true: '#5288c1' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          {/* Security Section */}
          <Text style={styles.sectionHeader}>SECURITY</Text>
          <View style={styles.card}>
            <Text style={styles.label}>
              {['teacher', 'student'].includes(user?.role) ? 'CURRENT 6-DIGIT PIN' : 'CURRENT PASSWORD'}
            </Text>
            <TextInput
              style={styles.input}
              value={oldCredential}
              onChangeText={setOldCredential}
              placeholder={['teacher', 'student'].includes(user?.role) ? '123456' : '••••••••'}
              placeholderTextColor="#708499"
              secureTextEntry={!['teacher', 'student'].includes(user?.role)}
              keyboardType={['teacher', 'student'].includes(user?.role) ? 'numeric' : 'default'}
            />

            <Text style={styles.label}>
              {['teacher', 'student'].includes(user?.role) ? 'NEW 6-DIGIT PIN' : 'NEW PASSWORD'}
            </Text>
            <TextInput
              style={styles.input}
              value={newCredential}
              onChangeText={setNewCredential}
              placeholder={['teacher', 'student'].includes(user?.role) ? '654321' : '••••••••'}
              placeholderTextColor="#708499"
              secureTextEntry={!['teacher', 'student'].includes(user?.role)}
              keyboardType={['teacher', 'student'].includes(user?.role) ? 'numeric' : 'default'}
            />

            {securityError ? <Text style={styles.errorText}>{securityError}</Text> : null}
            {securitySuccess ? <Text style={styles.successText}>{securitySuccess}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, changingPassword && styles.btnDisabled]}
              onPress={handleChangePassword}
              disabled={changingPassword}
              activeOpacity={0.8}
            >
              {changingPassword ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Update Password / PIN</Text>}
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
  logoutText: {
    color: '#e53935',
    fontSize: 14,
    fontWeight: '500',
  },
  body: {
    paddingBottom: 40,
  },
  profileBanner: {
    backgroundColor: '#17212b',
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 12,
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
    padding: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#708499',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#2b3a4b',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
    marginTop: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#708499',
  },
  infoValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#ffffff',
  },
  toggleDesc: {
    fontSize: 12,
    color: '#708499',
    marginTop: 2,
  },
  btn: {
    backgroundColor: '#5288c1',
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#e53935',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  successText: {
    color: '#4dbd74',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
});
