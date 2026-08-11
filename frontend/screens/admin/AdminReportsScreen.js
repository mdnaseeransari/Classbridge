import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import api from '../../services/api';
import { COLORS, SPACING, RADIUS } from '../../theme';

export default function AdminReportsScreen({ navigation }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending' | 'resolved' | 'dismissed' | 'all'

  const fetchReports = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await api.get('/admin/reports', {
        params: { status: statusFilter, limit: 50 },
      });
      setReports(res.data.reports || []);
    } catch (err) {
      console.error('[REPORTS] Error fetching reports:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports(true);
  }, [statusFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReports(false);
  };

  const getReasonLabel = (reason) => {
    const reasons = {
      inappropriate_content: 'Inappropriate Content',
      harassment: 'Harassment',
      contact_exchange: 'Contact Exchange',
      spam: 'Spam',
      other: 'Other',
    };
    return reasons[reason] || reason;
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'pending':
        return { bg: 'rgba(251, 191, 36, 0.15)', border: '#fbbf24', text: '#fbbf24' };
      case 'resolved':
        return { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', text: '#22c55e' };
      case 'dismissed':
        return { bg: 'rgba(100, 116, 139, 0.15)', border: '#64748b', text: '#94a3b8' };
      default:
        return { bg: COLORS.surface, border: COLORS.cardBorder, text: COLORS.textSecondary };
    }
  };

  const renderItem = ({ item }) => {
    const statusMeta = getStatusStyle(item.status);
    const dateStr = new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity
        style={styles.item}
        activeOpacity={0.75}
        onPress={() => navigation.navigate('AdminReportDetail', { reportId: item._id })}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg, borderColor: statusMeta.border }]}>
            <Text style={[styles.statusText, { color: statusMeta.text }]}>{item.status.toUpperCase()}</Text>
          </View>
          <Text style={styles.time}>{dateStr}</Text>
        </View>

        <Text style={styles.reason}>
          Reason: <Text style={{ color: COLORS.textPrimary, fontWeight: '700' }}>{getReasonLabel(item.reason)}</Text>
        </Text>

        <View style={styles.reportedContentBox}>
          <Text style={styles.reportedContentLabel}>Reported message:</Text>
          <Text style={styles.reportedContent} numberOfLines={2}>
            {item.message?.isDeleted ? '[Message Deleted]' : item.message?.content || '[Attachment/File]'}
          </Text>
        </View>

        <View style={styles.rolesRow}>
          <Text style={styles.roleText}>
            Reporter: <Text style={styles.roleValue}>{item.reporter?.name || 'Unknown'}</Text>
          </Text>
          <Text style={styles.roleText}>
            Target: <Text style={[styles.roleValue, { color: COLORS.danger }]}>{item.reportedUser?.name || 'Unknown'}</Text>
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports Queue</Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabRow}>
        {['pending', 'resolved', 'dismissed', 'all'].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.tab, statusFilter === s && styles.activeTab]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.tabText, statusFilter === s && styles.activeTabText]}>
              {s.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.accent} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No reports found.</Text>
            </View>
          }
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  backText: { color: COLORS.accent, fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingBottom: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  activeTab: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  tabText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
  activeTabText: { color: '#ffffff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
  item: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '800' },
  time: { fontSize: 11, color: COLORS.textSecondary },
  reason: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 },
  reportedContentBox: { backgroundColor: COLORS.bg, borderRadius: 8, padding: 12, marginBottom: 12 },
  reportedContentLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, fontWeight: '600' },
  reportedContent: { fontSize: 13, color: COLORS.textPrimary, fontStyle: 'italic' },
  rolesRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLORS.cardBorder, paddingTop: 10 },
  roleText: { fontSize: 12, color: COLORS.textSecondary },
  roleValue: { color: COLORS.textPrimary, fontWeight: '600' },
});
