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
} from 'react-native';
import api from '../../services/api';

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
    } catch (err) {
      console.error('[REPORT_DETAIL] Error loading report details:', err);
      Alert.alert('Error', 'Failed to load report details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportDetails();
  }, [reportId]);

  const handleAction = async (action) => {
    const actionLabels = {
      dismiss: 'dismiss',
      delete_message: 'delete reported message',
      ban_user: 'ban reported user',
      resolve: 'mark as resolved',
    };

    Alert.confirm
      ? Alert.confirm(`Are you sure you want to ${actionLabels[action]}?`)
      : Alert.alert(
          'Confirm Action',
          `Are you sure you want to ${actionLabels[action]}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Confirm',
              style: action === 'dismiss' ? 'default' : 'destructive',
              onPress: async () => {
                setSubmitting(true);
                try {
                  await api.patch(`/admin/reports/${reportId}/action`, {
                    action,
                    adminNotes: adminNotes.trim() || undefined,
                  });
                  Alert.alert('Success', `Report processed successfully.`);
                  navigation.goBack();
                } catch (err) {
                  Alert.alert('Error', err?.response?.data?.error || 'Failed to action report.');
                } finally {
                  setSubmitting(false);
                }
              },
            },
          ]
        );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Report not found.</Text>
      </View>
    );
  }

  const dateStr = new Date(report.createdAt).toLocaleString();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Reports</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Details</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Report Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={[styles.infoValue, { color: report.status === 'pending' ? '#fbbf24' : '#22c55e' }]}>
              {report.status.toUpperCase()}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reason:</Text>
            <Text style={styles.infoValue}>{report.reason.replace('_', ' ').toUpperCase()}</Text>
          </View>
          {report.details ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Details:</Text>
              <Text style={styles.infoValue}>{report.details}</Text>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reporter:</Text>
            <Text style={styles.infoValue}>{report.reporter?.name} ({report.reporter?.role})</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reported User:</Text>
            <Text style={[styles.infoValue, { color: '#ef4444' }]}>
              {report.reportedUser?.name} ({report.reportedUser?.role})
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Timestamp:</Text>
            <Text style={styles.infoValue}>{dateStr}</Text>
          </View>
          {report.resolvedBy ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Resolved By:</Text>
              <Text style={styles.infoValue}>{report.resolvedBy.name}</Text>
            </View>
          ) : null}
          {report.adminNotes ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Admin Notes:</Text>
              <Text style={styles.infoValue}>{report.adminNotes}</Text>
            </View>
          ) : null}
        </View>

        {/* Surrounding Chat Context */}
        <View style={styles.contextContainer}>
          <Text style={styles.sectionTitle}>Surrounding Chat Context</Text>
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
                      isReportedMessage ? styles.reportedMsgBubble : styles.normalMsgBubble,
                    ]}
                  >
                    <Text style={styles.msgSender}>
                      {msg.sender?.name || 'Deleted User'} ({msg.sender?.role || 'user'})
                      {isReportedMessage && ' [REPORTED MESSAGE]'}
                    </Text>
                    <Text style={styles.msgContent}>
                      {msg.isDeleted ? '[Message Deleted]' : msg.content || '[Attachment/File]'}
                    </Text>
                    <Text style={styles.msgTime}>{new Date(msg.createdAt).toLocaleTimeString()}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Action Panel */}
        {report.status === 'pending' && (
          <View style={styles.actionCard}>
            <Text style={styles.sectionTitle}>Process Report</Text>
            
            <Text style={styles.label}>Notes (Optional):</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g. Verified harassment, taking moderation action..."
              placeholderTextColor="#64748b"
              value={adminNotes}
              onChangeText={setAdminNotes}
              multiline
            />

            {submitting ? (
              <ActivityIndicator color="#38bdf8" style={{ marginTop: 20 }} />
            ) : (
              <View style={styles.btnCol}>
                <TouchableOpacity style={[styles.btn, styles.resolveBtn]} onPress={() => handleAction('resolve')}>
                  <Text style={styles.btnText}>Mark Resolved (No Action)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.dismissBtn]} onPress={() => handleAction('dismiss')}>
                  <Text style={styles.btnText}>Dismiss Report</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.deleteBtn]} onPress={() => handleAction('delete_message')}>
                  <Text style={[styles.btnText, { color: '#ef4444' }]}>Delete Reported Message</Text>
                </TouchableOpacity>
                {report.reportedUser && !report.reportedUser.isBanned && (
                  <TouchableOpacity style={[styles.btn, styles.banBtn]} onPress={() => handleAction('ban_user')}>
                    <Text style={[styles.btnText, { color: '#ef4444' }]}>Ban User & Delete Message</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
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
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#f8fafc', flex: 1, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  errorText: { color: '#ef4444', fontSize: 16 },
  body: { padding: 12, paddingBottom: 40 },
  card: { backgroundColor: '#1e293b', borderRadius: 10, padding: 16, borderLeftWidth: 4, borderLeftColor: '#38bdf8', marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#f8fafc', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  infoLabel: { color: '#64748b', fontSize: 13 },
  infoValue: { color: '#f8fafc', fontSize: 13, fontWeight: '600', maxWidth: '65%', textAlign: 'right' },
  contextContainer: { marginBottom: 16 },
  chatContext: { backgroundColor: '#1e293b', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#334155' },
  msgBubble: { padding: 10, borderRadius: 8, marginVertical: 6 },
  normalMsgBubble: { backgroundColor: '#0f172a' },
  reportedMsgBubble: { backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: '#ef4444' },
  msgSender: { fontSize: 11, fontWeight: '700', color: '#94a3b8', marginBottom: 2 },
  msgContent: { fontSize: 14, color: '#f8fafc' },
  msgTime: { fontSize: 9, color: '#64748b', alignSelf: 'flex-end', marginTop: 4 },
  emptyText: { color: '#64748b', fontSize: 14, fontStyle: 'italic' },
  actionCard: { backgroundColor: '#1e293b', borderRadius: 10, padding: 16, borderLeftWidth: 4, borderLeftColor: '#fbbf24' },
  label: { fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: '600' },
  notesInput: { backgroundColor: '#0f172a', borderRadius: 8, borderWidth: 1, borderColor: '#334155', padding: 12, color: '#f8fafc', fontSize: 14, minHeight: 70, textAlignVertical: 'top' },
  btnCol: { gap: 10, marginTop: 16 },
  btn: { paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#0f172a', fontSize: 14, fontWeight: '700' },
  resolveBtn: { backgroundColor: '#38bdf8' },
  dismissBtn: { backgroundColor: '#94a3b8' },
  deleteBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: '#ef4444' },
  banBtn: { backgroundColor: 'rgba(239, 68, 68, 0.25)', borderWidth: 1, borderColor: '#ef4444' },
});
