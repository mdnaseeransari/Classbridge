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

    // ── Named handlers so we can remove exactly these listeners later ────────
    // Using .off(eventName) without a fn reference removes ALL listeners for
    // that event, which would clobber ChatRoomScreen's own message_received
    // handler if both screens are in the stack simultaneously.

    const onMessageReceived = (msg) => {
      // Update the matching conversation in-place — no HTTP round-trip needed.
      // msg fields: { _id, conversation (id string), content, type, createdAt, sender }
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id === msg.conversation);
        if (idx === -1) return prev; // message for a conversation not yet loaded

        const updated = {
          ...prev[idx],
          lastMessage: {
            // preserve any existing fields (type, fileUrl, etc.) then patch
            ...(prev[idx].lastMessage || {}),
            content: msg.content,
            type: msg.type,
            createdAt: msg.createdAt,
            sender: msg.sender,
          },
          lastActivityAt: msg.createdAt,
          // Increment unread count if this is not our own message
          unreadCount:
            msg.sender?._id !== user?._id
              ? (prev[idx].unreadCount || 0) + 1
              : prev[idx].unreadCount || 0,
        };

        // Remove the updated conversation and move it to the front (most recent)
        const next = prev.filter((_, i) => i !== idx);
        return [updated, ...next];
      });
    };

    const onMessagesRead = ({ conversationId }) => {
      // Clear unread count for the conversation that was read
      setConversations((prev) =>
        prev.map((c) =>
          c._id === conversationId ? { ...c, unreadCount: 0 } : c
        )
      );
    };

    const onUserOnline = ({ userId }) => {
      setOnlineUsers((prev) => ({ ...prev, [userId]: true }));
    };

    const onUserOffline = ({ userId }) => {
      setOnlineUsers((prev) => ({ ...prev, [userId]: false }));
    };

    const setupSocket = async () => {
      if (!socketInstance) {
        socketInstance = await connectSocket();
      }

      if (socketInstance) {
        socketInstance.on('message_received', onMessageReceived);
        socketInstance.on('messages_read', onMessagesRead);
        socketInstance.on('user_online', onUserOnline);
        socketInstance.on('user_offline', onUserOffline);
      }
    };

    setupSocket();

    return () => {
      if (socketInstance) {
        // Remove only THIS screen's handlers, not all listeners for these events
        socketInstance.off('message_received', onMessageReceived);
        socketInstance.off('messages_read', onMessagesRead);
        socketInstance.off('user_online', onUserOnline);
        socketInstance.off('user_offline', onUserOffline);
      }
    };
  }, [user?._id]); // re-run if user changes (e.g. after login/logout cycle)

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
    // Navigate to select recipient.
    // getParent() is needed when this screen is mounted inside a Tab (AdminTabNavigator);
    // the Tab's navigation prop does not reach stack screens in the parent navigator.
    (navigation.getParent() ?? navigation).navigate('NewChatSelection');
  };

  const handleCreateGroup = () => {
    (navigation.getParent() ?? navigation).navigate('CreateGroup');
  };

  const handleJoinGroup = () => {
    (navigation.getParent() ?? navigation).navigate('JoinGroup');
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
        onPress={() => {
          // Same parent-escape pattern: ChatRoom is a stack screen, not a tab screen.
          (navigation.getParent() ?? navigation).navigate('ChatRoom', { conversationId: item._id, title });
        }}
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

  const isAdmin = ['admin', 'superadmin'].includes(user?.role);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[styles.newChatBtn, { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' }]} onPress={handleJoinGroup}>
            <Text style={[styles.newChatBtnText, { color: '#38bdf8' }]}>Join Group</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newChatBtn} onPress={handleCreateChat}>
            <Text style={styles.newChatBtnText}>＋ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isAdmin && (
        <View style={styles.adminBar}>
          <Text style={styles.adminBarText}>Group Administration:</Text>
          <TouchableOpacity style={styles.adminBarBtn} onPress={handleCreateGroup}>
            <Text style={styles.adminBarBtnText}>＋ Create Group Chat</Text>
          </TouchableOpacity>
        </View>
      )}

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
  adminBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  adminBarText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  adminBarBtn: { backgroundColor: '#8b5cf622', borderWidth: 1, borderColor: '#8b5cf6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  adminBarBtnText: { color: '#c084fc', fontSize: 12, fontWeight: '700' },
});
