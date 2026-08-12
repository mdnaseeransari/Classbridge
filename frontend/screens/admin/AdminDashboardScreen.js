import React, { useContext, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';

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
    } catch (err) {
      console.error('[DASHBOARD] Error fetching report count:', err);
    }
  };

  const fetchPendingResetCount = async () => {
    try {
      const res = await api.get('/admin/reset-requests');
      const count = res.data.requests?.length || 0;
      setPendingResetCount(count);
    } catch (err) {
      console.error('[DASHBOARD] Error fetching reset count:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPendingReportCount();
      fetchPendingResetCount();
    }, [])
  );

  const NavCard = ({ title, subtitle, color, onPress, icon, badgeCount }) => (
    <TouchableOpacity style={[styles.card, { borderLeftColor: color }]} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardContent}>
        <View style={styles.cardIconContainer}>{icon}</View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.cardTitle}>{title}</Text>
            {badgeCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeCount}</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#64748b" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Portal</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Ionicons
              name={isSuperAdmin ? 'star' : 'shield-checkmark'}
              size={14}
              color={isSuperAdmin ? '#fbbf24' : '#3b82f6'}
            />
            <Text style={[styles.headerSub, { marginTop: 0 }]}>
              {isSuperAdmin ? 'Super Admin' : 'Administrator'} · {user?.name}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

        {/* Core Management */}
        <Text style={styles.section}>User Management</Text>

        <NavCard
          title="All Users"
          subtitle="Browse, filter, search all users"
          color="#2563eb"
          icon={<Ionicons name="people" size={24} color="#2563eb" />}
          onPress={() => navigation.navigate('UserList')}
        />
        <NavCard
          title="Pending Approvals"
          subtitle="Review and approve new sign-ups"
          color="#fbbf24"
          icon={<Ionicons name="hourglass" size={24} color="#fbbf24" />}
          onPress={() => navigation.navigate('PendingApprovals')}
        />
        <NavCard
          title="Reset Requests"
          subtitle="Approve forgot password/PIN requests"
          color="#06b6d4"
          icon={<Ionicons name="key" size={24} color="#06b6d4" />}
          onPress={() => navigation.navigate('AdminResetRequests')}
          badgeCount={pendingResetCount}
        />
        {/* Monitoring & Moderation */}
        <Text style={styles.section}>Monitoring & Moderation</Text>
        <NavCard
          title="Reports Queue"
          subtitle="Review reported message violations"
          color="#ef4444"
          icon={<Ionicons name="warning" size={24} color="#ef4444" />}
          onPress={() => navigation.navigate('AdminReports')}
          badgeCount={pendingReportCount}
        />

        {/* Super Admin Only */}
        {isSuperAdmin && (
          <>
            <Text style={styles.section}>Super Admin Tools</Text>
            <NavCard
              title="Create Admin Account"
              subtitle="Add a new administrator directly"
              color="#10b981"
              icon={<Ionicons name="add-circle" size={24} color="#10b981" />}
              onPress={() => navigation.navigate('CreateAdmin')}
            />
          </>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  headerSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#ef4444',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 13,
  },
  body: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontVariant: ['small-caps'],
    marginTop: 24,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  cardIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#ef4444',
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
    fontWeight: '800',
  },
});
