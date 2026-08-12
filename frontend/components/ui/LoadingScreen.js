import React from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';

export default function LoadingScreen({ message = '' }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#5288c1" />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#17212b',
    padding: 24,
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: '#708499',
    textAlign: 'center',
  },
});
