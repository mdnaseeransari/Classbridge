import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Portal, Dialog, Button } from 'react-native-paper';
import * as adminApi from '../../services/adminApi';
import Avatar from '../../components/ui/Avatar';
import RoleBadge from '../../components/ui/RoleBadge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { usePanel } from '../../context/PanelContext';

const getTimeAgo = (dateString) => {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

function RequestRow({ request, onApprove, onReject, loading }) {
  const reqUser = request.user || {};
  const timeAgo = getTimeAgo(request.requestedAt);

  return (
    <View style={styles.requestRow}>
      <Avatar name={reqUser.name} role={reqUser.role} size="medium" />

      <View style={styles.details}>
        <View style={styles.nameLine}>
          <Text style={styles.nameText} numberOfLines={1}>{reqUser.name}</Text>
          <RoleBadge role={reqUser.role} style={{ alignSelf: 'center' }} />
        </View>
        <Text style={styles.subText} numberOfLines={1}>Requested {timeAgo}</Text>
      </View>

      <View style={styles.actionButtons}>
        {loading ? (
          <ActivityIndicator size="small" color="#5288c1" />
        ) : (
          <>
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: '#e53935' }]}
              onPress={() => onReject(request._id)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={16} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: '#4dbd74' }]}
              onPress={() => onApprove(request._id)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark" size={16} color="#ffffff" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

export default function ResetRequestsScreen(props) {
  const { navigation } = props;
  const { goBackPanel } = usePanel();
  const isInline = Platform.OS === 'web' && props.isInline;
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState('');

  // Dialog state
  const [dialogVisible, setDialogVisible] = useState(false);
  const [tempPin, setTempPin] = useState('');

  const fetchRequests = useCallback(async () => {
    try {
      setError('');
      const res = await adminApi.listPinResetRequests();
      setRequests(res.data.requests || []);
    } catch (_err) {
      setError('Failed to load pending reset requests.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchRequests().finally(() => setLoading(false));
    }, [fetchRequests])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  };

  const handleApprove = async (requestId) => {
    setActionLoading((prev) => ({ ...prev, [requestId]: true }));
    try {
      const res = await adminApi.approvePinResetRequest(requestId);
      setRequests((prev) => prev.filter((r) => r._id !== requestId));
      setTempPin(res.data.newPin || '');
      setDialogVisible(true);
    } catch (err) {
      const errMsg = err?.response?.data?.error || 'Failed to approve PIN reset.';
      if (Platform.OS === 'web') {
        window.alert(errMsg);
      } else {
        Alert.alert('Error', errMsg);
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const handleReject = async (requestId) => {
    const performReject = async () => {
      setActionLoading((prev) => ({ ...prev, [requestId]: true }));
      try {
        await adminApi.rejectPinResetRequest(requestId);
        setRequests((prev) => prev.filter((r) => r._id !== requestId));
        if (Platform.OS === 'web') {
          window.alert('Reset request rejected successfully.');
        } else {
          Alert.alert('Success', 'Reset request rejected successfully.');
        }
      } catch (err) {
        const errMsg = err?.response?.data?.error || 'Failed to reject PIN reset.';
        if (Platform.OS === 'web') {
          window.alert(errMsg);
        } else {
          Alert.alert('Error', errMsg);
        }
      } finally {
        setActionLoading((prev) => ({ ...prev, [requestId]: false }));
      }
    };

    if (Platform.OS === 'web') {
      const confirm = window.confirm('Are you sure you want to reject this request?');
      if (confirm) await performReject();
    } else {
      Alert.alert(
        'Reject Request',
        'Are you sure you want to reject this request?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reject', style: 'destructive', onPress: performReject },
        ]
      );
    }
  };

  const handleBack = () => {
    if (isInline) {
      goBackPanel();
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.root}>
      {!isInline && <StatusBar barStyle="light-content" backgroundColor="#17212b" />}

      <View style={[styles.header, isInline && { paddingTop: 14 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reset Requests</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{requests.length}</Text>
        </View>
      </View>

      <View style={styles.container}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <LoadingScreen />
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <RequestRow
                request={item}
                loading={!!actionLoading[item._id]}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#5288c1" />
            }
            ListEmptyComponent={
              <EmptyState title="No pending reset requests" subtitle="All PIN reset applications have been reviewed." />
            }
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>

      <Portal>
        <Dialog visible={dialogVisible} onDismiss={() => setDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>PIN Reset Approved</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              New PIN: <Text style={styles.dialogPin}>{tempPin}</Text>
            </Text>
            <Text style={styles.dialogSubText}>
              Communicate this to the user securely. Valid for 5 minutes.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogVisible(false)} textColor="#5288c1">Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  backBtn: {
    paddingRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  countBadge: {
    backgroundColor: '#5288c1',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  errorBox: {
    margin: 16,
    backgroundColor: 'rgba(229, 57, 53, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#e53935',
    textAlign: 'center',
    fontSize: 13,
  },
  requestRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  details: {
    flex: 1,
    marginLeft: 12,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  subText: {
    fontSize: 12,
    color: '#708499',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  smallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    backgroundColor: '#1b2432',
    borderRadius: 12,
  },
  dialogTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  dialogText: {
    color: '#ffffff',
    fontSize: 16,
    marginVertical: 8,
  },
  dialogPin: {
    color: '#4dbd74',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  dialogSubText: {
    color: '#708499',
    fontSize: 13,
    marginTop: 4,
  },
});
