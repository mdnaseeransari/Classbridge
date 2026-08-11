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
  Platform,
  Alert,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import { connectSocket, getSocket } from '../../services/socket';
import ChatRoomScreen from './ChatRoomScreen';
import { Ionicons } from '@expo/vector-icons';

export default function ChatInboxScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const rootNav = () => 
    navigation.getParent()?.getParent() ?? 
    navigation.getParent() ?? 
    navigation;
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [showArchived, setShowArchived] = useState(false);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [selectedConvoId, setSelectedConvoId] = useState(null);
  const [selectedConvoTitle, setSelectedConvoTitle] = useState('');

  const fetchConversations = async () => {
    try {
      const res = await api.get('/chat/conversations', { params: { archived: showArchived } });
      const convos = res.data.conversations || [];
      console.log('[DEBUG_INBOX] Raw Conversations:', JSON.stringify(convos, null, 2));
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
    // ── Named handlers so we can remove exactly these listeners later ────────
    // Using .off(eventName) without a fn reference removes ALL listeners for
    // that event, which would clobber ChatRoomScreen's own message_received
    // handler if both screens are in the stack simultaneously.

    const onMessageReceived = (msg) => {
      console.log('[INBOX-LISTENER-ALIVE]', Date.now());
      // DIAGNOSTIC — remove once confirmed working
      console.log('[INBOX] message_received fired. msg.conversation:', msg.conversation,
        '| type:', typeof msg.conversation);

      // Update the matching conversation in-place — no HTTP round-trip needed.
      // msg fields: { _id, conversation (id string), content, type, createdAt, sender }
      setConversations(prev => {
        const idx = prev.findIndex(c => c._id === msg.conversation);
        if (idx === -1) return prev;
        const updated = {
          ...prev[idx],
          lastMessage: {
            _id: msg._id,
            content: msg.content,
            type: msg.type,
            sender: msg.sender,
            createdAt: msg.createdAt,
          },
          lastActivityAt: msg.createdAt,
          unreadCount: msg.sender?._id !== user?._id 
            ? (prev[idx].unreadCount || 0) + 1 
            : prev[idx].unreadCount || 0,
        };
        const newList = [...prev];
        newList.splice(idx, 1);
        return [updated, ...newList];
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

    let socketInstance = null;

    const attachListeners = () => {
      if (!socketInstance) return;
      console.log('[INBOX] Attaching socket listeners. socket.id:', socketInstance.id,
        '| connected:', socketInstance.connected);
      socketInstance.off('message_received', onMessageReceived);
      socketInstance.on('message_received', onMessageReceived);
      socketInstance.off('messages_read', onMessagesRead);
      socketInstance.on('messages_read', onMessagesRead);
      socketInstance.off('user_online', onUserOnline);
      socketInstance.on('user_online', onUserOnline);
      socketInstance.off('user_offline', onUserOffline);
      socketInstance.on('user_offline', onUserOffline);
    };

    const setupSocket = async () => {
      socketInstance = getSocket();
      if (!socketInstance) {
        socketInstance = await connectSocket();
      }
      if (!socketInstance) return;

      if (socketInstance.connected) {
        attachListeners();
      } else {
        socketInstance.once('connect', attachListeners);
      }
    };

    setupSocket();

    return () => {
      const s = getSocket() || socketInstance;
      if (s) {
        s.off('connect', attachListeners);
        s.off('message_received', onMessageReceived);
        s.off('messages_read', onMessagesRead);
        s.off('user_online', onUserOnline);
        s.off('user_offline', onUserOffline);
        s.off('connect_error');
      }
    };
  }, [user?._id]); // re-run if user changes (e.g. after login/logout cycle)

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchConversations().finally(() => setLoading(false));
    }, [user, showArchived])
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
    rootNav().navigate('NewChatSelection');
  };

  const handleCreateGroup = () => {
    rootNav().navigate('CreateGroup');
  };

  const handleJoinGroup = () => {
    rootNav().navigate('JoinGroup');
  };

  const togglePin = async (convoId, isPinned) => {
    try {
      if (isPinned) {
        await api.post(`/chat/conversations/${convoId}/unpin`);
      } else {
        await api.post(`/chat/conversations/${convoId}/pin`);
      }
      fetchConversations();
    } catch (err) {
      console.error('[INBOX] Error toggling pin:', err);
    }
  };

  const toggleArchive = async (convoId, isArchived) => {
    try {
      if (isArchived) {
        await api.post(`/chat/conversations/${convoId}/unarchive`);
      } else {
        await api.post(`/chat/conversations/${convoId}/archive`);
      }
      fetchConversations();
    } catch (err) {
      console.error('[INBOX] Error toggling archive:', err);
    }
  };

  const toggleMute = async (convoId, isMuted) => {
    try {
      if (isMuted) {
        await api.post(`/chat/conversations/${convoId}/unmute`);
      } else {
        await api.post(`/chat/conversations/${convoId}/mute`);
      }
      fetchConversations();
    } catch (err) {
      console.error('[INBOX] Error toggling mute:', err);
    }
  };

  const handleLongPress = (item) => {
    setSelectedConvo(item);
    setActionMenuVisible(true);
  };

  const renderItem = ({ item }) => {
    let title = item.name || 'Group Chat';
    let isOnline = false;
    let otherParticipant = null;

    if (item.type === 'direct') {
      otherParticipant = item.participants.find((p) => p._id !== user?._id);
      title = otherParticipant?.name || 'Chat';
      isOnline = !!onlineUsers[otherParticipant?._id];
    }

    const unreadCount = item.unreadCount || 0;

    const formattedTime = item.lastActivityAt
      ? new Date(item.lastActivityAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    let avatarBgColor = 'rgba(37, 99, 235, 0.1)';
    let avatarTextColor = '#2563eb';
    if (item.type === 'direct' && otherParticipant) {
      if (otherParticipant.role === 'teacher') {
        avatarBgColor = 'rgba(16, 185, 129, 0.1)';
        avatarTextColor = '#10b981';
      } else if (otherParticipant.role === 'student') {
        avatarBgColor = 'rgba(124, 58, 237, 0.1)';
        avatarTextColor = '#7c3aed';
      }
    } else {
      avatarBgColor = 'rgba(239, 68, 68, 0.1)';
      avatarTextColor = '#ef4444';
    }

    const getPressProps = (convo) => {
      if (Platform.OS === 'web') {
        return {
          onContextMenu: (e) => {
            e.preventDefault();
            handleLongPress(convo);
          }
        };
      }
      return {
        onLongPress: () => handleLongPress(convo),
      };
    };

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
        <TouchableOpacity
          style={[styles.item, { flex: 1, borderBottomWidth: 0 }]}
          activeOpacity={0.75}
          onPress={() => {
            if (isLargeScreen) {
              setSelectedConvoId(item._id);
              setSelectedConvoTitle(title);
            } else {
              rootNav().navigate('ChatRoom', { conversationId: item._id, title });
            }
          }}
          {...getPressProps(item)}
        >
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: avatarBgColor }]}>
              <Text style={[styles.avatarText, { color: avatarTextColor }]}>
                {title[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            {item.type === 'direct' && isOnline && <View style={styles.onlineDot} />}
          </View>
  
          <View style={styles.details}>
            <View style={styles.row}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {title}
                </Text>
                {item.isPinned && <Ionicons name="pin" size={14} color="#fbbf24" />}
                {item.isMuted && <Ionicons name="volume-mute" size={14} color="#64748b" />}
              </View>
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
        <TouchableOpacity
          onPress={() => handleLongPress(item)}
          style={{ paddingHorizontal: 16, paddingVertical: 20, justifyContent: 'center' }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#64748b" />
        </TouchableOpacity>
      </View>
    );
  };

  const isAdmin = ['admin', 'superadmin'].includes(user?.role);

  const renderInboxContent = () => {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0e1a' }}>
        <View style={styles.header}>
          {showArchived ? (
            <TouchableOpacity onPress={() => setShowArchived(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="arrow-back" size={20} color="#2563eb" />
              <Text style={styles.backText}>Inbox</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.headerTitle}>Messages</Text>
          )}
          
          {showArchived ? (
            <Text style={styles.headerTitle}>Archived</Text>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[styles.newChatBtn, { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1e293b' }]} onPress={handleJoinGroup}>
                <Text style={[styles.newChatBtnText, { color: '#2563eb' }]}>Join Group</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.newChatBtn} onPress={handleCreateChat}>
                <Text style={styles.newChatBtnText}>＋ New</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {isAdmin && !showArchived && (
          <View style={styles.adminBar}>
            <Text style={styles.adminBarText}>Group Administration:</Text>
            <TouchableOpacity style={styles.adminBarBtn} onPress={handleCreateGroup}>
              <Text style={styles.adminBarBtnText}>＋ Create Group Chat</Text>
            </TouchableOpacity>
          </View>
        )}

        {!showArchived && (
          <TouchableOpacity
            style={styles.archiveHeaderRow}
            onPress={() => setShowArchived(true)}
          >
            <Ionicons name="archive" size={18} color="#2563eb" style={{ marginRight: 8 }} />
            <Text style={styles.archiveHeaderText}>Archived Conversations</Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item._id}
            extraData={{ conversations, onlineUsers }}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2563eb" />
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
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />
      {isLargeScreen ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {/* Left Pane: Inbox List */}
          <View style={{ width: 350, borderRightWidth: 1, borderRightColor: '#1e293b' }}>
            {renderInboxContent()}
          </View>
          {/* Right Pane: Chat Room */}
          <View style={{ flex: 1, backgroundColor: '#0e1621' }}>
            {selectedConvoId ? (
              <ChatRoomScreen
                key={selectedConvoId}
                route={{ params: { conversationId: selectedConvoId, title: selectedConvoTitle } }}
                navigation={navigation}
                isInline={true}
              />
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#64748b', fontSize: 16 }}>Select a conversation to start chatting</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        renderInboxContent()
      )}

      {/* Conversation Action Sheet Modal */}
      <Modal
        visible={actionMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActionMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { marginBottom: 12 }]}>Conversation Options</Text>
            
            <TouchableOpacity
              style={[styles.actionMenuBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
              onPress={() => {
                setActionMenuVisible(false);
                togglePin(selectedConvo?._id, selectedConvo?.isPinned);
              }}
            >
              <Ionicons name={selectedConvo?.isPinned ? 'pin' : 'pin-outline'} size={18} color="#2563eb" />
              <Text style={styles.actionMenuBtnText}>
                {selectedConvo?.isPinned ? 'Unpin Chat' : 'Pin Chat'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionMenuBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
              onPress={() => {
                setActionMenuVisible(false);
                toggleArchive(selectedConvo?._id, selectedConvo?.isArchived);
              }}
            >
              <Ionicons name={selectedConvo?.isArchived ? 'archive' : 'archive-outline'} size={18} color="#2563eb" />
              <Text style={styles.actionMenuBtnText}>
                {selectedConvo?.isArchived ? 'Unarchive Chat' : 'Archive Chat'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionMenuBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
              onPress={() => {
                setActionMenuVisible(false);
                toggleMute(selectedConvo?._id, selectedConvo?.isMuted);
              }}
            >
              <Ionicons name={selectedConvo?.isMuted ? 'volume-high' : 'volume-mute'} size={18} color="#2563eb" />
              <Text style={styles.actionMenuBtnText}>
                {selectedConvo?.isMuted ? 'Unmute Chat' : 'Mute Chat'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionMenuBtn, { borderBottomWidth: 0, marginTop: 12 }]}
              onPress={() => setActionMenuVisible(false)}
            >
              <Text style={[styles.actionMenuBtnText, { color: '#64748b', textAlign: 'center' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#f1f5f9' },
  newChatBtn: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  newChatBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
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
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#0a0e1a',
  },
  details: { flex: 1, marginLeft: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  name: { fontSize: 16, fontWeight: '700', color: '#f1f5f9' },
  time: { fontSize: 11, color: '#64748b' },
  preview: { fontSize: 13, color: '#64748b', flex: 1, marginRight: 8 },
  badge: { backgroundColor: '#2563eb', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  adminBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  adminBarText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  adminBarBtn: { backgroundColor: 'rgba(37, 99, 235, 0.1)', borderWidth: 1, borderColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  adminBarBtnText: { color: '#2563eb', fontSize: 12, fontWeight: '700' },
  archiveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  archiveHeaderText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '700',
  },
  backText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#111827', borderRadius: 12, width: '85%', padding: 20, borderWidth: 1, borderColor: '#1e293b' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#f1f5f9' },
  actionMenuBtn: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  actionMenuBtnText: {
    fontSize: 15,
    color: '#f1f5f9',
    fontWeight: '600',
  },
});
