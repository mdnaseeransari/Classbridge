import React, { useContext } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { COLORS, SPACING, RADIUS } from '../../theme';

export default function HomeScreen() {
  const { user, logout } = useContext(AuthContext);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.welcome}>Welcome back,</Text>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.role}>Role: {user?.role?.toUpperCase()}</Text>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.xxl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  welcome: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.accent,
    marginTop: SPACING.xs,
  },
  role: {
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xxl,
  },
  logoutButton: {
    backgroundColor: COLORS.danger,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxl,
    borderRadius: RADIUS.button,
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
