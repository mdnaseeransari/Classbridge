import React, { useContext, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';

export default function PendingApprovalScreen() {
  const { user, checkAuth, logout } = useContext(AuthContext);
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    setChecking(true);
    await checkAuth();
    setChecking(false);
  };

  return (
    <View style={styles.root}>
      <View style={styles.container}>
        <View style={styles.iconBox}>
          <Ionicons name="time-outline" size={64} color="#ffa726" />
        </View>

        <Text style={styles.title}>Waiting for Approval</Text>

        <Text style={styles.subtitle}>
          Hello <Text style={styles.boldName}>{user?.name || 'User'}</Text>, your account registration has been received and is currently waiting for administrator approval.
        </Text>

        <Text style={styles.caption}>
          You will gain access to ClassBridge messaging as soon as an admin approves your request.
        </Text>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={checking}
          activeOpacity={0.8}
        >
          {checking ? (
            <ActivityIndicator color="#5288c1" />
          ) : (
            <Text style={styles.refreshButtonText}>Check Status</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#17212b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    width: '100%',
    ...(Platform.OS === 'web' && {
      maxWidth: 480,
      alignSelf: 'center',
    }),
  },
  iconBox: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#708499',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  boldName: {
    color: '#ffffff',
    fontWeight: '600',
  },
  caption: {
    fontSize: 12,
    color: '#708499',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 32,
  },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#5288c1',
    backgroundColor: 'transparent',
    borderRadius: 10,
    height: 52,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  refreshButtonText: {
    color: '#5288c1',
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    paddingVertical: 10,
  },
  logoutText: {
    color: '#e53935',
    fontSize: 14,
    fontWeight: '500',
  },
});
