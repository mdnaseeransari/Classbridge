import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePanel } from '../../context/PanelContext';

const ACCENT = '#5288c1';
const TEXT2 = '#708499';
const SURFACE = '#232e3c';
const BORDER = '#0e1621';

const getActiveTab = (leftPanel) => {
  const dashPanels = ['dashboard', 'userList', 'userDetail', 'pendingApprovals', 'resetRequests', 'reports', 'reportDetail', 'createAdmin', 'promoteToAdmin'];
  if (dashPanels.includes(leftPanel)) return 'Dashboard';
  if (leftPanel === 'settings') return 'Settings';
  return 'Chat';
};

export default function WebTabBar({ state, navigation, totalUnread = 0 }) {
  const { leftPanel, navigatePanel, resetPanel } = usePanel();
  const activeTab = getActiveTab(leftPanel);

  const tabs = [
    { 
      name: 'Dashboard', 
      icon: 'shield-outline', 
      activeIcon: 'shield',
      label: 'Dashboard'
    },
    { 
      name: 'Chat', 
      icon: 'chatbubble-outline', 
      activeIcon: 'chatbubble',
      label: 'Chat'
    },
    { 
      name: 'Settings', 
      icon: 'settings-outline', 
      activeIcon: 'settings',
      label: 'Settings'
    },
  ];

  const handlePress = (tabName) => {
    if (tabName === 'Chat') {
      resetPanel();
      navigation.navigate('Chat');
    } else if (tabName === 'Dashboard') {
      navigatePanel('dashboard');
      navigation.navigate('Chat');
    } else if (tabName === 'Settings') {
      navigatePanel('settings');
      navigation.navigate('Chat');
    }
  };

  return (
    <View style={styles.container}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => handlePress(tab.name)}
            activeOpacity={0.7}
          >
            <View style={styles.iconWrapper}>
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={22}
                color={isActive ? ACCENT : TEXT2}
              />
              {tab.name === 'Chat' && totalUnread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[
              styles.label,
              { color: isActive ? ACCENT : TEXT2 }
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    height: 56,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  iconWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#e53935',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
});
