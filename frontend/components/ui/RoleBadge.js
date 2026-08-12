import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const ROLE_STYLES = {
  superadmin: { text: '#a78bfa', bg: '#6b21a820', label: 'Super Admin' },
  admin: { text: '#60a5fa', bg: '#1d4ed820', label: 'Admin' },
  teacher: { text: '#34d399', bg: '#065f4620', label: 'Teacher' },
  student: { text: '#fbbf24', bg: '#92400e20', label: 'Student' },
};

export default function RoleBadge({ role = 'student', style }) {
  const badgeStyle = ROLE_STYLES[role] || ROLE_STYLES.student;
  return (
    <View style={[styles.badge, { backgroundColor: badgeStyle.bg }, style]}>
      <Text style={[styles.text, { color: badgeStyle.text }]}>{badgeStyle.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    lineHeight: 10,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
