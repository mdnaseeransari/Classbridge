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
import { COLORS, SPACING, RADIUS } from '../../theme';

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
    if (loadingMore) return <ActivityIndicator color={COLORS.accent} style={{ marginVertical: 16 }} />;
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
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
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item._id}
          renderItem={renderLogItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.accent} />
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
  backText: { color: COLORS.accent, fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  errorBox: {
    margin: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: COLORS.danger,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: COLORS.danger, textAlign: 'center', fontSize: 13 },
  emptyText: { color: COLORS.textSecondary, fontSize: 15 },
  logCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.card,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  logAction: { fontSize: 12, fontWeight: '800', color: COLORS.accent },
  logTime: { fontSize: 11, color: COLORS.textSecondary },
  logText: { fontSize: 13, color: COLORS.textPrimary, marginTop: 3 },
  bold: { fontWeight: '700', color: COLORS.textSecondary },
  noteBox: {
    marginTop: 8,
    backgroundColor: COLORS.bg,
    borderRadius: 6,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.cardBorder,
  },
  noteText: { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic' },
  loadMore: {
    margin: 16,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.button,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  loadMoreText: { color: COLORS.accent, fontWeight: '700', fontSize: 14 },
});
