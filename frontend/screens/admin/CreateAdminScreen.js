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
import { usePanel } from '../../context/PanelContext';

export default function CreateAdminScreen(props) {
  const { navigation } = props;
  const { goBackPanel } = usePanel();
  const isInline = Platform.OS === 'web' && props.isInline;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await adminApi.createAdmin({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      if (isInline) {
        goBackPanel();
      } else {
        navigation.goBack();
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create admin account.');
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
        <Text style={styles.headerTitle}>Create Admin</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.container}>
        <View style={styles.body}>
          <Text style={styles.label}>FULL NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. John Doe"
            placeholderTextColor="#708499"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. john@classbridge.com"
            placeholderTextColor="#708499"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>PASSWORD (MIN 8 CHARS)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor="#708499"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleCreate}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.btnText}>Create Admin Account</Text>
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
