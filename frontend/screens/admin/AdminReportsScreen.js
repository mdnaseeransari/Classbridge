import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { usePanel } from '../../context/PanelContext';

export default function AdminReportsScreen(props) {
  const { navigation } = props;
  const { goBackPanel, navigatePanel } = usePanel();
  const isInline = Platform.OS === 'web' && props.isInline;
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');

  const fetchReports = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await api.get('/admin/reports', {
        params: { status: statusFilter, limit: 50 },
      });
      setReports(res.data.reports || []);
    } catch (_err) {
      // silent fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports(true);

    let unsubscribe;
    if (navigation && typeof navigation.addListener === 'function') {
      unsubscribe = navigation.addListener('focus', () => {
        fetchReports(false);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [statusFilter, navigation]);

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

  const renderItem = ({ item }) => {
    const dateStr = new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.75}
        onPress={() => isInline ? navigatePanel('reportDetail', { reportId: item._id }) : navigation.navigate('AdminReportDetail', { reportId: item._id })}
      >
        <View style={styles.cardHeader}>
          <StatusBadge status={item.status} />
          <Text style={styles.timeText}>{dateStr}</Text>
        </View>

        <Text style={styles.reasonText}>{getReasonLabel(item.reason)}</Text>

        <View style={styles.quoteBox}>
          <Text style={styles.quoteText} numberOfLines={2}>
            {item.message?.isDeleted
              ? (item.reportedMessageSnapshot?.content
                  ? `[Deleted] ${item.reportedMessageSnapshot.content}`
                  : `[Deleted] ${item.reportedMessageSnapshot?.fileName || 'File'}`)
              : (item.message?.content || '[Attachment / File]')}
          </Text>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.userText}>Reporter: <Text style={styles.boldWhite}>{item.reporter?.name || 'Unknown'}</Text></Text>
          <Text style={styles.userText}>Target: <Text style={styles.boldDanger}>{item.reportedUser?.name || 'Unknown'}</Text></Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      {!isInline && <StatusBar barStyle="light-content" backgroundColor="#17212b" />}

      <View style={[styles.header, isInline && { paddingTop: 14 }]}>
        <TouchableOpacity onPress={() => isInline ? goBackPanel() : navigation.goBack()} style={{ paddingRight: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports Queue</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.container}>
        {/* Status Filter Chips */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            {['pending', 'resolved', 'dismissed', 'all'].map((s) => {
              const active = statusFilter === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                  onPress={() => setStatusFilter(s)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
                    {s}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <LoadingScreen />
        ) : (
          <FlatList
            data={reports}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#5288c1" />
            }
            ListEmptyComponent={<EmptyState title="No reports found" subtitle="No violation reports match this status." />}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          />
        )}
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
  filterSection: {
    backgroundColor: '#232e3c',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  chipScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 6,
  },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#5288c1',
  },
  chipInactive: {
    backgroundColor: '#2b3a4b',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  chipTextInactive: {
    color: '#708499',
  },
  card: {
    backgroundColor: '#232e3c',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 12,
    color: '#708499',
  },
  reasonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  quoteBox: {
    backgroundColor: '#2b3a4b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#e53935',
  },
  quoteText: {
    fontSize: 13,
    color: '#ffffff',
    fontStyle: 'italic',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#0e1621',
    paddingTop: 10,
  },
  userText: {
    fontSize: 12,
    color: '#708499',
  },
  boldWhite: {
    color: '#ffffff',
    fontWeight: '500',
  },
  boldDanger: {
    color: '#e53935',
    fontWeight: '500',
  },
});
