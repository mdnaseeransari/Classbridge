import React, { useState, useEffect, useContext, useCallback } from 'react';
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
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import { connectSocket, getSocket } from '../../services/socket';

export default function ChatInboxScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});

  const fetchConversations = async () => {
    try {
      const res = await api.get('/chat/conversations');
      const convos = res.data.conversations || [];
      setConversations(convos);

      // Collect user IDs to query initial online status
      const socketInstance = getSocket();
      if (socketInstance && socketInstance.connected) {
        const otherIds = convos
          .filter((c) => c.type === 'direct')
          .map((c) => {
            const other = c.participants.find((p) => p._id !== user?._id);
            return other?._id;
          })
          .filter(Boolean);

        if (otherIds.length > 0) {
          socketInstance.emit('get_online_status', { userIds: otherIds }, (resAck) => {
            if (resAck && resAck.statuses) {
              setOnlineUsers((prev) => ({ ...prev, ...resAck.statuses }));
            }
          });
        }
      }
    } catch (err) {
      console.error('[CHAT_INBOX] Error fetching conversations:', err);
    }
  };

  // Connect socket and listen to events when screen mounts
  useEffect(() => {
    let socketInstance = getSocket();

    const setupSocket = async () => {
      if (!socketInstance) {
        socketInstance = await connectSocket();
      }

      if (socketInstance) {
        socketInstance.on('message_received', (msg) => {
          // Re-fetch conversation list to get latest message preview & update position
          fetchConversations();
        });

        socketInstance.on('messages_read', ({ conversationId }) => {
          fetchConversations();
        });

        socketInstance.on('user_online', ({ userId }) => {
          setOnlineUsers((prev) => ({ ...prev, [userId]: true }));
        });

        socketInstance.on('user_offline', ({ userId }) => {
          setOnlineUsers((prev) => ({ ...prev, [userId]: false }));
        });
      }
    };

    setupSocket();

    return () => {
      if (socketInstance) {
        socketInstance.off('message_received');
        socketInstance.off('messages_read');
        socketInstance.off('user_online');
        socketInstance.off('user_offline');
      }
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchConversations().finally(() => setLoading(false));
    }, [user])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  };

  const handleCreateChat = () => {
    // Navigate to select recipient
    navigation.navigate('NewChatSelection');
  };

  const renderItem = ({ item }) => {
    // Determine title, avatar and online status
    let title = item.name || 'Group Chat';
    let isOnline = false;
    let otherParticipant = null;

    if (item.type === 'direct') {
      otherParticipant = item.participants.find((p) => p._id !== user?._id);
      title = otherParticipant?.name || 'Chat';
      isOnline = !!onlineUsers[otherParticipant?._id];
    }

    // Check unread count: messages where sender !== user and user is not in readBy
    const unreadCount = item.unreadCount || 0;

    const formattedTime = item.lastActivityAt
      ? new Date(item.lastActivityAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <TouchableOpacity
        style={styles.item}
        activeOpacity={0.75}
        onPress={() => navigation.navigate('ChatRoom', { conversationId: item._id, title })}
      >
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: item.type === 'direct' ? '#38bdf822' : '#8b5cf622' }]}>
            <Text style={[styles.avatarText, { color: item.type === 'direct' ? '#38bdf8' : '#8b5cf6' }]}>
              {title[0]?.toUpperCase() || '?'}
            </Text>
          </View>
          {item.type === 'direct' && isOnline && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.details}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.time}>{formattedTime}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.preview} numberOfLines={1}>
              {item.lastMessage?.content || 'No messages yet'}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity style={styles.newChatBtn} onPress={handleCreateChat}>
          <Text style={styles.newChatBtnText}>＋ New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#38bdf8" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No conversations yet.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
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
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#f8fafc' },
  newChatBtn: { backgroundColor: '#38bdf8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  newChatBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 15 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  avatarContainer: { position: 'relative' },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800' },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  details: { flex: 1, marginLeft: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  name: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  time: { fontSize: 11, color: '#64748b' },
  preview: { fontSize: 13, color: '#94a3b8', flex: 1, marginRight: 8 },
  badge: { backgroundColor: '#38bdf8', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#0f172a', fontSize: 11, fontWeight: '800' },
});
