import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

const STATUS_COLORS = {
  approved: '#4dbd74',
  pending: '#ffa726',
  locked: '#ffa726',
  rejected: '#e53935',
  banned: '#e53935',
};

export default function StatusBadge({ status = 'pending' }) {
  const dotColor = STATUS_COLORS[status] || STATUS_COLORS.pending;
  const labelMap = {
    approved: 'Approved',
    pending: 'Pending',
    locked: 'Locked',
    rejected: 'Rejected',
    banned: 'Banned',
  };
  const label = labelMap[status] || 'Pending';

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    color: '#708499',
    fontWeight: '500',
  },
});
