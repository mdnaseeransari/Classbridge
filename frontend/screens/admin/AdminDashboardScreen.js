import React, { useContext, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import RoleBadge from '../../components/ui/RoleBadge';

export default function AdminDashboardScreen({ navigation }) {
  const { user, logout } = useContext(AuthContext);
  const isSuperAdmin = user?.role === 'superadmin';
  const [pendingReportCount, setPendingReportCount] = useState(0);
  const [pendingResetCount, setPendingResetCount] = useState(0);

  const fetchPendingReportCount = async () => {
    try {
      const res = await api.get('/admin/reports', { params: { status: 'pending', limit: 1 } });
      const total = res.data.pagination?.total || 0;
      setPendingReportCount(total);
    } catch (_err) {
      // silent fail
    }
  };

  const fetchPendingResetCount = async () => {
    try {
      const res = await api.get('/admin/reset-requests');
      const count = res.data.requests?.length || 0;
      setPendingResetCount(count);
    } catch (_err) {
      // silent fail
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPendingReportCount();
      fetchPendingResetCount();
    }, [])
  );

  const FeatureRow = ({ title, subtitle, iconName, iconBg, onPress, badgeCount }) => (
    <TouchableOpacity style={styles.featureRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.iconSquare, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={20} color="#ffffff" />
      </View>
      <View style={styles.rowCenter}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      {badgeCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color="#708499" style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#17212b" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Portal</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Subtitle bar */}
      <View style={styles.subBar}>
        <RoleBadge role={user?.role || 'admin'} style={{ alignSelf: 'center' }} />
        <Text style={styles.subBarName}>{user?.name}</Text>
      </View>

      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {/* User Management Section */}
          <Text style={styles.sectionHeader}>USER MANAGEMENT</Text>

          <FeatureRow
            title="All Users"
            subtitle="Browse, filter, and manage accounts"
            iconName="people"
            iconBg="#5288c1"
            onPress={() => navigation.navigate('UserList')}
          />
          <FeatureRow
            title="Pending Approvals"
            subtitle="Review and approve new registration requests"
            iconName="time"
            iconBg="#ffa726"
            onPress={() => navigation.navigate('PendingApprovals')}
          />
          <FeatureRow
            title="Reset Requests"
            subtitle="Approve forgot password/PIN requests"
            iconName="key"
            iconBg="#2b5278"
            onPress={() => navigation.navigate('AdminResetRequests')}
            badgeCount={pendingResetCount}
          />

          {/* Moderation Section */}
          <Text style={styles.sectionHeader}>MODERATION</Text>
          <FeatureRow
            title="Reports Queue"
            subtitle="Review reported message violations"
            iconName="warning"
            iconBg="#e53935"
            onPress={() => navigation.navigate('AdminReports')}
            badgeCount={pendingReportCount}
          />

          {/* Super Admin Tools */}
          {isSuperAdmin && (
            <>
              <Text style={styles.sectionHeader}>SUPER ADMIN TOOLS</Text>
              <FeatureRow
                title="Create Admin Account"
                subtitle="Add a new administrator directly"
                iconName="person-add"
                iconBg="#4dbd74"
                onPress={() => navigation.navigate('CreateAdmin')}
              />
            </>
          )}
        </ScrollView>
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
  logoutText: {
    color: '#e53935',
    fontSize: 14,
    fontWeight: '500',
  },
  subBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#232e3c',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  subBarName: {
    fontSize: 13,
    color: '#708499',
    fontWeight: '500',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  body: {
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '500',
    color: '#708499',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  featureRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#17212b',
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  iconSquare: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowCenter: {
    flex: 1,
    marginLeft: 12,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  rowSubtitle: {
    fontSize: 12,
    color: '#708499',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#e53935',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
