import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

export default function EmptyState({ title = 'No items found', subtitle = '', buttonText = '', onPress = null }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {buttonText && onPress ? (
        <TouchableOpacity style={styles.btn} activeOpacity={0.8} onPress={onPress}>
          <Text style={styles.btnText}>{buttonText}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#708499',
    textAlign: 'center',
    marginBottom: 16,
  },
  btn: {
    backgroundColor: '#5288c1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
