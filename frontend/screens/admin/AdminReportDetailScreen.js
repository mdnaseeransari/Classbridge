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
import api from '../../services/api';
import { COLORS, SPACING, RADIUS } from '../../theme';

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

  const executeAction = async (action) => {
    setSubmitting(true);
    try {
      await api.patch(`/admin/reports/${reportId}/action`, {
        action,
        adminNotes: adminNotes.trim() || undefined,
      });
      if (Platform.OS === 'web') {
        alert('Report processed successfully.');
      } else {
        Alert.alert('Success', `Report processed successfully.`);
      }
      navigation.goBack();
    } catch (err) {
      if (Platform.OS === 'web') {
        alert(err?.response?.data?.error || 'Failed to action report.');
      } else {
        Alert.alert('Error', err?.response?.data?.error || 'Failed to action report.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = (action) => {
    const actionLabels = {
      dismiss: 'dismiss',
      delete_message: 'delete reported message',
      ban_user: 'ban reported user',
      resolve: 'mark as resolved',
    };

    if (Platform.OS === 'web') {
      const confirmAction = window.confirm(`Are you sure you want to ${actionLabels[action]}?`);
      if (confirmAction) {
        executeAction(action);
      }
      return;
    }

    Alert.alert(
      'Confirm Action',
      `Are you sure you want to ${actionLabels[action]}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: action === 'dismiss' ? 'default' : 'destructive',
          onPress: () => executeAction(action),
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
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
            <Text style={[styles.infoValue, { color: report.status === 'pending' ? '#fbbf24' : '#10b981' }]}>
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
            <Text style={[styles.infoValue, { color: COLORS.danger }]}>
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
              placeholderTextColor={COLORS.textSecondary}
              value={adminNotes}
              onChangeText={setAdminNotes}
              multiline
            />

            {submitting ? (
              <ActivityIndicator color={COLORS.accent} style={{ marginTop: 20 }} />
            ) : (
              <View style={styles.btnCol}>
                <TouchableOpacity style={[styles.btn, styles.resolveBtn]} onPress={() => handleAction('resolve')}>
                  <Text style={styles.btnText}>Mark Resolved (No Action)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.dismissBtn]} onPress={() => handleAction('dismiss')}>
                  <Text style={styles.btnText}>Dismiss Report</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.deleteBtn]} onPress={() => handleAction('delete_message')}>
                  <Text style={[styles.btnText, { color: COLORS.danger }]}>Delete Reported Message</Text>
                </TouchableOpacity>
                {report.reportedUser && !report.reportedUser.isBanned && (
                  <TouchableOpacity style={[styles.btn, styles.banBtn]} onPress={() => handleAction('ban_user')}>
                    <Text style={[styles.btnText, { color: COLORS.danger }]}>Ban User & Delete Message</Text>
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
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, flex: 1, textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  errorText: { color: COLORS.danger, fontSize: 16 },
  body: { padding: 12, paddingBottom: 40 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.card, padding: 16, borderLeftWidth: 4, borderLeftColor: COLORS.accent, marginBottom: 16, borderWidth: 1, borderColor: COLORS.cardBorder },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  infoLabel: { color: COLORS.textSecondary, fontSize: 13 },
  infoValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600', maxWidth: '65%', textAlign: 'right' },
  contextContainer: { marginBottom: 16 },
  chatContext: { backgroundColor: COLORS.surface, borderRadius: RADIUS.card, padding: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  msgBubble: { padding: 10, borderRadius: 8, marginVertical: 6 },
  normalMsgBubble: { backgroundColor: COLORS.bg },
  reportedMsgBubble: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: COLORS.danger },
  msgSender: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 2 },
  msgContent: { fontSize: 14, color: COLORS.textPrimary },
  msgTime: { fontSize: 9, color: COLORS.textSecondary, alignSelf: 'flex-end', marginTop: 4 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, fontStyle: 'italic' },
  actionCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.card, padding: 16, borderLeftWidth: 4, borderLeftColor: '#fbbf24', borderWidth: 1, borderColor: COLORS.cardBorder },
  label: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6, fontWeight: '600' },
  notesInput: { backgroundColor: COLORS.bg, borderRadius: RADIUS.button, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 12, color: COLORS.textPrimary, fontSize: 14, minHeight: 70, textAlignVertical: 'top' },
  btnCol: { gap: 10, marginTop: 16 },
  btn: { paddingVertical: 12, borderRadius: RADIUS.button, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  resolveBtn: { backgroundColor: COLORS.accent },
  dismissBtn: { backgroundColor: COLORS.textSecondary },
  deleteBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: COLORS.danger },
  banBtn: { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1, borderColor: COLORS.danger },
});
