import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import api from '../../services/api';

export default function AdminChatMonitoringRoomScreen({ route, navigation }) {
  const { conversationId, title } = route.params;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/admin/chat/conversations/${conversationId}/messages`, { params: { page: 1 } });
      const fetched = res.data.messages || [];
      setMessages([...fetched].reverse());
      setHasMore(fetched.length === 50);
    } catch (err) {
      console.error('[MONITORING_ROOM] Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [conversationId]);

  const loadOlderMessages = async () => {
    if (loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    const nextPage = page + 1;
    try {
      const res = await api.get(`/admin/chat/conversations/${conversationId}/messages`, { params: { page: nextPage } });
      const fetched = res.data.messages || [];
      if (fetched.length > 0) {
        setMessages((prev) => [...prev, ...[...fetched].reverse()]);
        setPage(nextPage);
      }
      setHasMore(fetched.length === 50);
    } catch (err) {
      console.error('[MONITORING_ROOM] Error loading older messages:', err);
    } finally {
      setLoadingOlder(false);
    }
  };

  const renderBubble = ({ item }) => {
    const formattedTime = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Render bubble using basic alignments since it's read-only and sender details are populated
    return (
      <View style={styles.bubbleWrapper}>
        <Text style={styles.senderName}>
          {item.sender?.name} ({item.sender?.role || 'user'})
        </Text>
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{item.content}</Text>
          <Text style={styles.bubbleTime}>{formattedTime}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Monitor</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Warning Banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerText}>🛡 READ-ONLY CHAT MONITORING VIEW</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderBubble}
          inverted
          onEndReached={loadOlderMessages}
          onEndReachedThreshold={0.2}
          ListFooterComponent={loadingOlder ? <ActivityIndicator color="#38bdf8" style={{ marginVertical: 10 }} /> : null}
          contentContainerStyle={styles.listContent}
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
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#f8fafc', flex: 1, textAlign: 'center' },
  banner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: '#ef4444',
    paddingVertical: 8,
    alignItems: 'center',
  },
  bannerText: { color: '#f87171', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 14, paddingVertical: 10 },
  bubbleWrapper: { marginBottom: 12, width: '100%' },
  senderName: { fontSize: 11, color: '#64748b', marginBottom: 2, marginLeft: 4, fontWeight: '700' },
  bubble: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  bubbleText: { fontSize: 14, color: '#f8fafc' },
  bubbleTime: { fontSize: 9, marginTop: 4, alignSelf: 'flex-end', color: '#64748b' },
});
