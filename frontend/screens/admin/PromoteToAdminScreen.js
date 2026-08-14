import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as adminApi from '../../services/adminApi';
import RoleBadge from '../../components/ui/RoleBadge';
import { usePanel } from '../../context/PanelContext';

export default function PromoteToAdminScreen(props) {
  const { route, navigation } = props;
  const { goBackPanel, leftPanelParams } = usePanel();
  const isInline = Platform.OS === 'web' && props.isInline;
  const user = isInline ? leftPanelParams?.user : route?.params?.user;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePromote = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required for admin setup.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await adminApi.promoteToAdmin(user._id, {
        email: email.trim().toLowerCase(),
        password,
        note: note.trim() || undefined,
      });
      if (isInline) {
        goBackPanel();
      } else {
        navigation.navigate('AdminTabs');
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to promote user to admin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      {!isInline && <StatusBar barStyle="light-content" backgroundColor="#17212b" />}

      <View style={[styles.header, isInline && { paddingTop: 14 }]}>
        <TouchableOpacity onPress={() => isInline ? goBackPanel() : navigation.goBack()} style={{ paddingRight: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Promote to Admin</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.container}>
        <View style={styles.body}>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardLabel}>TARGET USER</Text>
            <Text style={styles.infoName}>{user.name}</Text>
            <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <RoleBadge role={user.role} style={{ alignSelf: 'center' }} />
              <Text style={styles.infoMeta}>{user.phone || '—'}</Text>
            </View>
          </View>

          <Text style={styles.label}>ADMIN EMAIL ADDRESS</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. admin@classbridge.com"
            placeholderTextColor="#708499"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>ADMIN PASSWORD (MIN 8 CHARS)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor="#708499"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />

          <Text style={styles.label}>PROMOTION NOTE (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="Reason for promotion..."
            placeholderTextColor="#708499"
            value={note}
            onChangeText={setNote}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handlePromote}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.btnText}>Promote Account</Text>
            )}
          </TouchableOpacity>
        </View>
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
    padding: 24,
  },
  infoCard: {
    backgroundColor: '#232e3c',
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
  },
  infoCardLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#708499',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  infoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  infoMeta: {
    fontSize: 12,
    color: '#708499',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#708499',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#2b3a4b',
    borderRadius: 10,
    height: 52,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14,
  },
  errorText: {
    color: '#e53935',
    fontSize: 13,
    marginTop: 14,
  },
  btn: {
    marginTop: 32,
    backgroundColor: '#5288c1',
    height: 52,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
