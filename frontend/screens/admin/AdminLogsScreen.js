import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as adminApi from '../../services/adminApi';

export default function AdminLogsScreen({ navigation }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(async (pageNum = 1, append = false) => {
    try {
      setError('');
      const res = await adminApi.getAdminLogs({ page: pageNum, limit: 20 });
      const fetched = res.data.logs || [];
      setTotalPages(res.data.pagination?.totalPages || 1);

      if (append) {
        setLogs((prev) => [...prev, ...fetched]);
      } else {
        setLogs(fetched);
        setPage(1);
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to fetch admin logs.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchLogs(1, false).finally(() => setLoading(false));
    }, [fetchLogs])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLogs(1, false);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    const nextPage = page + 1;
    setPage(nextPage);
    setLoadingMore(true);
    await fetchLogs(nextPage, true);
    setLoadingMore(false);
  };

  const renderFooter = () => {
    if (loadingMore) return <ActivityIndicator color="#38bdf8" style={{ marginVertical: 16 }} />;
    if (page < totalPages) {
      return (
        <TouchableOpacity style={styles.loadMore} onPress={handleLoadMore}>
          <Text style={styles.loadMoreText}>Load More</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  const renderLogItem = ({ item }) => {
    const formattedDate = new Date(item.createdAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          <Text style={styles.logAction}>{item.action.toUpperCase()}</Text>
          <Text style={styles.logTime}>{formattedDate}</Text>
        </View>
        <Text style={styles.logText}>
          <Text style={styles.bold}>By:</Text> {item.performedBy?.name || 'Unknown'} ({item.performedBy?.role || 'admin'})
        </Text>
        {item.targetSnapshot && (
          <Text style={styles.logText}>
            <Text style={styles.bold}>Target:</Text> {item.targetSnapshot.name || '—'} {item.targetSnapshot.phone ? `(${item.targetSnapshot.phone})` : ''}
          </Text>
        )}
        {item.note ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteText}>{item.note}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Action Logs</Text>
        <View style={{ width: 40 }} />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item._id}
          renderItem={renderLogItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#a78bfa" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No admin logs found.</Text>
            </View>
          }
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
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
  backText: { color: '#38bdf8', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  errorBox: {
    margin: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: '#f87171', textAlign: 'center', fontSize: 13 },
  emptyText: { color: '#64748b', fontSize: 15 },
  logCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  logAction: { fontSize: 12, fontWeight: '800', color: '#a78bfa' },
  logTime: { fontSize: 11, color: '#64748b' },
  logText: { fontSize: 13, color: '#e2e8f0', marginTop: 3 },
  bold: { fontWeight: '700', color: '#94a3b8' },
  noteBox: {
    marginTop: 8,
    backgroundColor: '#0f172a',
    borderRadius: 6,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#475569',
  },
  noteText: { fontSize: 12, color: '#94a3b8', fontStyle: 'italic' },
  loadMore: {
    margin: 16,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  loadMoreText: { color: '#38bdf8', fontWeight: '700', fontSize: 14 },
});
