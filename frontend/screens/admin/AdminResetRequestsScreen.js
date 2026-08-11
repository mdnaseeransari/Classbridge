import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { COLORS } from '../../theme';

export default function AdminResetRequestsScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState(null);
  
  // Custom credential reset modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [customCred, setCustomCred] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/admin/reset-requests');
      setRequests(res.data.requests || []);
    } catch (err) {
      console.error('[RESET_QUEUE] fetch error:', err);
      setError('Failed to fetch pending reset requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (requestId, action, customCredential = '') => {
    setResolvingId(requestId);
    try {
      const res = await api.post(`/admin/reset-requests/${requestId}/resolve`, {
        action,
        customCredential: customCredential.trim() || undefined,
      });

      setRequests((prev) => prev.filter((r) => r._id !== requestId));

      if (action === 'approve') {
        const cred = res.data.tempCredential;
        const msg = `Successfully approved reset request!\n\nTemporary credential for the user:\n👉  ${cred}\n\nPlease copy and send this to the user.`;
        
        Alert.alert('Reset Success', msg);
      } else {
        Alert.alert('Success', 'Reset request rejected.');
      }
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to resolve request.');
    } finally {
      setResolvingId(null);
      setModalVisible(false);
      setSelectedRequest(null);
      setCustomCred('');
    }
  };

  const openApproveModal = (req) => {
    setSelectedRequest(req);
    setCustomCred('');
    setModalVisible(true);
  };

  const renderItem = ({ item }) => {
    const isResolving = resolvingId === item._id;
    const reqUser = item.user || {};
    const formattedDate = new Date(item.createdAt).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.userName}>{reqUser.name || 'Unknown User'}</Text>
            <Text style={styles.userMeta}>
              {reqUser.role?.toUpperCase()} • {item.type === 'pin' ? 'PIN Reset' : 'Password Reset'}
            </Text>
          </View>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>

        <View style={styles.detailsRow}>
          <Text style={styles.detailsText}>
            {item.type === 'pin' ? `📞 Phone: ${reqUser.phone || 'N/A'}` : `📧 Email: ${reqUser.email || 'N/A'}`}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnReject]}
            onPress={() => handleAction(item._id, 'reject')}
            disabled={isResolving}
          >
            <Ionicons name="close" size={16} color="#ef4444" />
            <Text style={styles.btnTextReject}>Reject</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnApprove]}
            onPress={() => openApproveModal(item)}
            disabled={isResolving}
          >
            {isResolving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#ffffff" />
                <Text style={styles.btnTextApprove}>Approve Reset</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="arrow-back" size={20} color="#2563eb" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reset Requests</Text>
        <TouchableOpacity onPress={fetchRequests} style={{ padding: 4 }}>
          <Ionicons name="refresh" size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchRequests}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#64748b" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No pending password/PIN reset requests!</Text>
            </View>
          }
          contentContainerStyle={{ padding: 16 }}
        />
      )}

      {/* Approve Modal */}
      {selectedRequest && (
        <Modal visible={modalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Approve Reset Request</Text>
              <Text style={styles.modalSub}>
                User: <Text style={{ fontWeight: '700', color: '#f1f5f9' }}>{selectedRequest.user?.name}</Text>
              </Text>
              <Text style={styles.modalSub}>
                Request: <Text style={{ fontWeight: '700', color: '#f1f5f9' }}>
                  {selectedRequest.type === 'pin' ? '6-Digit PIN' : 'Password'}
                </Text>
              </Text>

              <Text style={styles.modalLabel}>
                Custom New {selectedRequest.type === 'pin' ? 'PIN' : 'Password'} (Optional)
              </Text>
              <TextInput
                style={styles.modalInput}
                value={customCred}
                onChangeText={setCustomCred}
                placeholder={selectedRequest.type === 'pin' ? 'e.g. 123456 (6 digits)' : 'e.g. TempPass123!'}
                placeholderTextColor="#64748b"
                keyboardType={selectedRequest.type === 'pin' ? 'numeric' : 'default'}
              />
              <Text style={styles.modalHint}>
                If left blank, a secure temporary credential will be generated automatically.
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => {
                    setModalVisible(false);
                    setSelectedRequest(null);
                  }}
                >
                  <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnConfirm]}
                  onPress={() => handleAction(selectedRequest._id, 'approve', customCred)}
                >
                  <Text style={styles.modalBtnTextConfirm}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#ef4444', textAlign: 'center', fontSize: 15, marginBottom: 16 },
  retryBtn: { backgroundColor: '#2563eb', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  retryBtnText: { color: '#ffffff', fontWeight: '700' },
  emptyText: { color: '#64748b', fontSize: 15, textAlign: 'center' },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  userName: { fontSize: 16, fontWeight: '800', color: '#f1f5f9' },
  userMeta: { fontSize: 12, color: '#64748b', marginTop: 4, fontWeight: '600' },
  date: { fontSize: 11, color: '#64748b' },
  detailsRow: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 10 },
  detailsText: { fontSize: 14, color: '#94a3b8' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
  },
  btnReject: { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  btnApprove: { borderColor: '#10b981', backgroundColor: '#10b981' },
  btnTextReject: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  btnTextApprove: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#111827', borderRadius: 16, width: '85%', padding: 20, borderWidth: 1, borderColor: '#1e293b' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#f1f5f9', marginBottom: 16 },
  modalSub: { fontSize: 14, color: '#64748b', marginBottom: 8 },
  modalLabel: { fontSize: 13, color: '#64748b', marginTop: 14, marginBottom: 6, fontWeight: '600' },
  modalInput: { backgroundColor: '#0a0e1a', borderRadius: 8, borderWidth: 1, borderColor: '#1e293b', padding: 12, color: '#f1f5f9', fontSize: 15 },
  modalHint: { fontSize: 11, color: '#64748b', marginTop: 6, fontStyle: 'italic' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#1e293b' },
  modalBtnConfirm: { backgroundColor: '#10b981' },
  modalBtnTextCancel: { color: '#94a3b8', fontWeight: '700' },
  modalBtnTextConfirm: { color: '#ffffff', fontWeight: '700' },
});
