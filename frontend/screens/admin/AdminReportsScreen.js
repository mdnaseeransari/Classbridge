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
        return { bg: '#1e293b', border: '#334155', text: '#94a3b8' };
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
          Reason: <Text style={{ color: '#f8fafc', fontWeight: '700' }}>{getReasonLabel(item.reason)}</Text>
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
            Target: <Text style={[styles.roleValue, { color: '#ef4444' }]}>{item.reportedUser?.name || 'Unknown'}</Text>
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

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
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#38bdf8" />
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
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backText: { color: '#38bdf8', fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#f8fafc' },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    paddingBottom: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeTab: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  tabText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  activeTabText: { color: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 15 },
  item: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '800' },
  time: { fontSize: 11, color: '#64748b' },
  reason: { fontSize: 13, color: '#94a3b8', marginBottom: 8 },
  reportedContentBox: { backgroundColor: '#0f172a', borderRadius: 8, padding: 12, marginBottom: 12 },
  reportedContentLabel: { fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: '600' },
  reportedContent: { fontSize: 13, color: '#f8fafc', fontStyle: 'italic' },
  rolesRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#334155', paddingTop: 10 },
  roleText: { fontSize: 12, color: '#94a3b8' },
  roleValue: { color: '#f8fafc', fontWeight: '600' },
});
