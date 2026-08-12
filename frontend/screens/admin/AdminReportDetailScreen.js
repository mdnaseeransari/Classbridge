import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingScreen from '../../components/ui/LoadingScreen';

export default function AdminReportDetailScreen({ route, navigation }) {
  const { reportId } = route.params;
  const [report, setReport] = useState(null);
  const [contextMessages, setContextMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReportDetails = async () => {
    try {
      const res = await api.get(`/admin/reports/${reportId}`);
      setReport(res.data.report);
      setContextMessages(res.data.contextMessages || []);
    } catch (_err) {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportDetails();
  }, [reportId]);

  const executeAction = async (action) => {
    setSubmitting(true);
    try {
      await api.patch(`/admin/reports/${reportId}/action`, {
        action,
        adminNotes: adminNotes.trim() || undefined,
      });
      navigation.goBack();
    } catch (_err) {
      console.error('[ADMIN] executeAction error:', _err);
      const errMsg = _err.response?.data?.error || _err.message || 'Unknown error occurred';
      Alert.alert('Action Failed', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = (action) => {
    executeAction(action);
  };

  const handleDeleteReport = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/admin/reports/${reportId}`);
      navigation.goBack();
    } catch (_err) {
      console.error('[ADMIN] deleteReport error:', _err);
      const errMsg = _err.response?.data?.error || _err.message || 'Unknown error occurred';
      Alert.alert('Delete Failed', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingScreen />;

  if (!report) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Report not found.</Text>
      </View>
    );
  }

  const dateStr = new Date(report.createdAt).toLocaleString();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#17212b" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* Main info card */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardSectionTitle}>REPORT INFORMATION</Text>
              <StatusBadge status={report.status} />
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Reason</Text>
              <Text style={styles.infoValue}>{report.reason.replace('_', ' ').toUpperCase()}</Text>
            </View>

            {report.details ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Details</Text>
                <Text style={styles.infoValue}>{report.details}</Text>
              </View>
            ) : null}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Reported Content</Text>
              <Text style={[styles.infoValue, { color: '#ffffff', fontWeight: '500' }]}>
                {report.reportedMessageSnapshot?.content || report.reportedMessageSnapshot?.fileName || '[File / Attachment]'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Reporter</Text>
              <Text style={styles.infoValue}>{report.reporter?.name} ({report.reporter?.role})</Text>
            </View>

            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => report.reportedUser?._id && navigation.navigate('UserDetail', { userId: report.reportedUser._id })}
            >
              <Text style={styles.infoLabel}>Reported User</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[styles.infoValue, { color: '#e53935' }]}>
                  {report.reportedUser?.name} ({report.reportedUser?.role})
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#708499" />
              </View>
            </TouchableOpacity>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Timestamp</Text>
              <Text style={styles.infoValue}>{dateStr}</Text>
            </View>
          </View>

          {/* Surrounding Chat Context */}
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>SURROUNDING CHAT CONTEXT</Text>
            {contextMessages.length === 0 ? (
              <Text style={styles.emptyText}>No chat context available.</Text>
            ) : (
              <View style={styles.chatContext}>
                {contextMessages.map((msg) => {
                  const isReportedMessage = String(msg._id) === String(report.message?._id);
                  return (
                    <View
                      key={msg._id}
                      style={[
                        styles.msgBubble,
                        isReportedMessage && styles.reportedMsgBubble,
                      ]}
                    >
                      <Text style={styles.msgSender}>
                        {msg.sender?.name || 'User'} ({msg.sender?.role || 'user'})
                        {isReportedMessage && ' [REPORTED MESSAGE]'}
                      </Text>
                      <Text style={styles.msgContent}>
                        {isReportedMessage && msg.isDeleted && report.reportedMessageSnapshot
                          ? `[Deleted] Original Content: ${report.reportedMessageSnapshot.content || report.reportedMessageSnapshot.fileName || '[File]'}`
                          : (msg.isDeleted ? '[Message Deleted]' : msg.content || '[Attachment / File]')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Action Panel */}
          {report.status === 'pending' && (
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>PROCESS REPORT</Text>

              <TextInput
                style={styles.noteInput}
                placeholder="Reason or resolution note..."
                placeholderTextColor="#708499"
                value={adminNotes}
                onChangeText={setAdminNotes}
              />

              {submitting ? (
                <ActivityIndicator color="#5288c1" style={{ marginTop: 16 }} />
              ) : (
                <View style={styles.actionCol}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#4dbd74' }]}
                    onPress={() => handleAction('resolve')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnText}>Mark Resolved</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#ffa726' }]}
                    onPress={() => handleAction('delete_message')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnText}>Delete Reported Message</Text>
                  </TouchableOpacity>

                  {report.reportedUser && !report.reportedUser.isBanned && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#e53935' }]}
                      onPress={() => handleAction('ban_user')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnText}>Ban Sender & Delete Message</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#2b3a4b' }]}
                    onPress={() => handleAction('dismiss')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnText}>Dismiss Report</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {report.status !== 'pending' && (
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>REPORT RECORD ACTIONS</Text>
              {submitting ? (
                <ActivityIndicator color="#5288c1" style={{ marginTop: 16 }} />
              ) : (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#e53935', marginTop: 8 }]}
                  onPress={handleDeleteReport}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnText}>Delete Report from Database</Text>
                </TouchableOpacity>
              )}
            </View>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#e53935',
    fontSize: 14,
  },
  body: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#232e3c',
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardSectionTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#708499',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  infoLabel: {
    color: '#708499',
    fontSize: 14,
  },
  infoValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  chatContext: {
    marginTop: 8,
  },
  msgBubble: {
    backgroundColor: '#2b3a4b',
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
  },
  reportedMsgBubble: {
    borderLeftWidth: 3,
    borderLeftColor: '#e53935',
  },
  msgSender: {
    fontSize: 11,
    color: '#708499',
    marginBottom: 4,
  },
  msgContent: {
    fontSize: 14,
    color: '#ffffff',
  },
  emptyText: {
    color: '#708499',
    fontSize: 13,
    marginTop: 8,
  },
  noteInput: {
    backgroundColor: '#2b3a4b',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 16,
  },
  actionCol: {
    gap: 10,
  },
  actionBtn: {
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
