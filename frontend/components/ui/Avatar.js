import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

const ROLE_COLORS = {
  superadmin: '#6b21a8',
  admin: '#1d4ed8',
  teacher: '#065f46',
  student: '#92400e',
};

export default function Avatar({ name = '?', role = 'student', size = 'medium', showOnline = false }) {
  const sizeMap = {
    small: 32,
    medium: 40,
    large: 56,
  };
  const diameter = sizeMap[size] || 40;
  const initials = name ? name.trim().charAt(0).toUpperCase() : '?';
  const bgColor = ROLE_COLORS[role] || ROLE_COLORS.student;

  return (
    <View style={[styles.container, { width: diameter, height: diameter }]}>
      <View style={[styles.avatar, { backgroundColor: bgColor, borderRadius: diameter / 2 }]}>
        <Text style={[styles.initials, { fontSize: diameter * 0.45 }]}>
          {initials}
        </Text>
      </View>
      {showOnline && (
        <View style={[styles.onlineDot, { right: -1, bottom: -1 }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatar: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#ffffff',
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4dbd74',
    borderWidth: 2,
    borderColor: '#17212b',
  },
});
