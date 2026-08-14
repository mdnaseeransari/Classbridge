import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StatusBar,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import { connectSocket, getSocket } from '../../services/socket';
import ChatRoomScreen from './ChatRoomScreen';
import { Ionicons } from '@expo/vector-icons';
import OfflineBanner from '../../components/ui/OfflineBanner';
import SettingsScreen from '../main/SettingsScreen';
import AdminDashboardScreen from '../admin/AdminDashboardScreen';
import { usePanel } from '../../context/PanelContext';
import UserListScreen from '../admin/UserListScreen';
import UserDetailScreen from '../admin/UserDetailScreen';
import PendingApprovalsScreen from '../admin/PendingApprovalsScreen';
import ResetRequestsScreen from '../admin/ResetRequestsScreen';
import AdminReportsScreen from '../admin/AdminReportsScreen';
import AdminReportDetailScreen from '../admin/AdminReportDetailScreen';
import CreateAdminScreen from '../admin/CreateAdminScreen';
import PromoteToAdminScreen from '../admin/PromoteToAdminScreen';

import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import LoadingScreen from '../../components/ui/LoadingScreen';

export default function ChatInboxScreen({ route, navigation }) {
  const { user } = useContext(AuthContext);
  const rootNav = () => 
    navigation.getParent()?.getParent() ?? 
    navigation.getParent() ?? 
    navigation;
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  const { leftPanel, leftPanelParams, navigatePanel, goBackPanel, resetPanel } = usePanel();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [showArchived, setShowArchived] = useState(false);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [selectedConvoId, setSelectedConvoId] = useState(null);
  const [selectedConvoTitle, setSelectedConvoTitle] = useState('');

  // Search state
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchConversations = async () => {
    try {
      const res = await api.get('/chat/conversations', { params: { archived: showArchived } });
      const convos = res.data.conversations || [];
      setConversations(convos);

      const initialOnlineMap = {};
      convos.forEach((c) => {
        c.participants?.forEach((p) => {
          if (p._id !== user?._id) {
            initialOnlineMap[p._id] = !!p.isOnline;
          }
        });
      });
      setOnlineUsers((prev) => ({ ...prev, ...initialOnlineMap }));

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
    } catch (_err) {
      // silent fail
    }
  };

  useEffect(() => {
    const onMessageReceived = (msg) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id === msg.conversation);
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
          unreadCount:
            msg.sender?._id !== user?._id
              ? (prev[idx].unreadCount || 0) + 1
              : prev[idx].unreadCount || 0,
        };
        const newList = [...prev];
        newList.splice(idx, 1);
        return [updated, ...newList];
      });
    };

    const onMessagesRead = ({ conversationId }) => {
      setConversations((prev) =>
        prev.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c))
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
      }
    };
  }, [user?._id]);

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
    } catch (_err) {
      // silent fail
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
    } catch (_err) {
      // silent fail
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
    } catch (_err) {
      // silent fail
    }
  };

  const handleLongPress = (item) => {
    setSelectedConvo(item);
    setActionMenuVisible(true);
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    let title = c.name || 'Group Chat';
    if (c.type === 'direct') {
      const other = c.participants.find((p) => p._id !== user?._id);
      title = other?.name || 'Chat';
    }
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

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

    const getPressProps = (convo) => {
      if (Platform.OS === 'web') {
        return {
          onContextMenu: (e) => {
            e.preventDefault();
            handleLongPress(convo);
          },
        };
      }
      return {
        onLongPress: () => handleLongPress(convo),
      };
    };

    return (
      <TouchableOpacity
        style={styles.itemRow}
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
        <Avatar
          name={title}
          role={otherParticipant?.role || 'student'}
          size="medium"
          showOnline={item.type === 'direct' && isOnline}
        />

        <View style={styles.details}>
          <View style={styles.topRow}>
            <View style={styles.nameBox}>
              <Text style={styles.nameText} numberOfLines={1}>
                {title}
              </Text>
              {item.isPinned && <Ionicons name="pin" size={13} color="#ffa726" />}
              {item.isMuted && <Ionicons name="volume-mute" size={13} color="#708499" />}
            </View>
            <Text style={styles.timeText}>{formattedTime}</Text>
          </View>

          <View style={styles.bottomRow}>
            <Text style={styles.previewText} numberOfLines={1}>
              {item.lastMessage?.content || (item.lastMessage?.type === 'file' ? '📁 Attachment' : 'No messages yet')}
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.rowActionBtn}
          onPress={(e) => {
            if (e && e.stopPropagation) {
              e.stopPropagation();
            }
            handleLongPress(item);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-vertical" size={16} color="#708499" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const isAdmin = ['admin', 'superadmin'].includes(user?.role);

  const renderInboxContent = () => {
    return (
      <View style={styles.inboxRoot}>
        {/* Telegram Header */}
        <View style={styles.header}>
          {isSearchMode ? (
            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={18} color="#708499" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search..."
                placeholderTextColor="#708499"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              <TouchableOpacity onPress={() => { setIsSearchMode(false); setSearchQuery(''); }}>
                <Ionicons name="close" size={20} color="#708499" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {showArchived ? (
                <TouchableOpacity onPress={() => setShowArchived(false)} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={22} color="#ffffff" />
                  <Text style={styles.headerTitle}>Archived</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => {
                      if (Platform.OS === 'web') {
                        navigatePanel('settings');
                      } else {
                        navigation.navigate('Settings');
                      }
                    }}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="menu" size={24} color="#ffffff" />
                  </TouchableOpacity>
                  <Text style={styles.headerTitle}>ClassBridge</Text>
                </View>
              )}

              <View style={styles.headerRightActions}>
                <TouchableOpacity onPress={() => setIsSearchMode(true)} style={styles.iconBtn}>
                  <Ionicons name="search" size={20} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCreateChat} style={styles.iconBtn}>
                  <Ionicons name="create-outline" size={22} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Admin thin banner */}
        {isAdmin && !showArchived && (
          <View style={styles.adminBar}>
            <Text style={styles.adminBarTitle}>Group Controls</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={handleJoinGroup}>
                <Text style={styles.adminBarBtnText}>Join Link</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreateGroup}>
                <Text style={styles.adminBarBtnText}>+ Create Group</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Archived list row link */}
        {!showArchived && (
          <TouchableOpacity style={styles.archiveHeaderRow} onPress={() => setShowArchived(true)}>
            <Ionicons name="archive-outline" size={18} color="#5288c1" style={{ marginRight: 10 }} />
            <Text style={styles.archiveHeaderText}>Archived Conversations</Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <LoadingScreen />
        ) : (
          <FlatList
            data={filteredConversations}
            keyExtractor={(item) => item._id}
            extraData={{ conversations, onlineUsers }}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#5288c1" />
            }
            ListEmptyComponent={
              <EmptyState title="No conversations yet" subtitle="Start a new message to begin chatting." />
            }
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>
    );
  };

  const renderLeftPanelContent = () => {
    if (Platform.OS === 'web') {
      if (leftPanel === 'settings') {
        return <SettingsScreen navigation={navigation} isInline={true} />;
      }
      if (leftPanel === 'dashboard') {
        return <AdminDashboardScreen navigation={navigation} isInline={true} />;
      }
      if (leftPanel === 'userList') {
        return <UserListScreen navigation={navigation} isInline={true} />;
      }
      if (leftPanel === 'userDetail') {
        return <UserDetailScreen navigation={navigation} isInline={true} />;
      }
      if (leftPanel === 'pendingApprovals') {
        return <PendingApprovalsScreen navigation={navigation} isInline={true} />;
      }
      if (leftPanel === 'resetRequests') {
        return <ResetRequestsScreen navigation={navigation} isInline={true} />;
      }
      if (leftPanel === 'reports') {
        return <AdminReportsScreen navigation={navigation} isInline={true} />;
      }
      if (leftPanel === 'reportDetail') {
        return <AdminReportDetailScreen navigation={navigation} isInline={true} />;
      }
      if (leftPanel === 'createAdmin') {
        return <CreateAdminScreen navigation={navigation} isInline={true} />;
      }
      if (leftPanel === 'promoteToAdmin') {
        return <PromoteToAdminScreen navigation={navigation} isInline={true} />;
      }
    }
    return renderInboxContent();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#17212b" />
      <OfflineBanner />
      {isLargeScreen ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ width: 350, borderRightWidth: 1, borderRightColor: '#0e1621' }}>
            {renderLeftPanelContent()}
          </View>
          <View style={{ flex: 1, backgroundColor: '#17212b' }}>
            {selectedConvoId ? (
              <ChatRoomScreen
                key={selectedConvoId}
                route={{ params: { conversationId: selectedConvoId, title: selectedConvoTitle } }}
                navigation={navigation}
                isInline={true}
              />
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#708499', fontSize: 16 }}>Select a conversation to start chatting</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        renderLeftPanelContent()
      )}

      {/* Action Menu Sheet */}
      <Modal
        visible={actionMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActionMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Options</Text>

            <TouchableOpacity
              style={styles.actionMenuBtn}
              onPress={() => {
                setActionMenuVisible(false);
                togglePin(selectedConvo?._id, selectedConvo?.isPinned);
              }}
            >
              <Ionicons name={selectedConvo?.isPinned ? 'pin' : 'pin-outline'} size={18} color="#5288c1" />
              <Text style={styles.actionMenuBtnText}>
                {selectedConvo?.isPinned ? 'Unpin Chat' : 'Pin Chat'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionMenuBtn}
              onPress={() => {
                setActionMenuVisible(false);
                toggleArchive(selectedConvo?._id, selectedConvo?.isArchived);
              }}
            >
              <Ionicons name={selectedConvo?.isArchived ? 'archive' : 'archive-outline'} size={18} color="#5288c1" />
              <Text style={styles.actionMenuBtnText}>
                {selectedConvo?.isArchived ? 'Unarchive Chat' : 'Archive Chat'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionMenuBtn}
              onPress={() => {
                setActionMenuVisible(false);
                toggleMute(selectedConvo?._id, selectedConvo?.isMuted);
              }}
            >
              <Ionicons name={selectedConvo?.isMuted ? 'volume-high' : 'volume-mute'} size={18} color="#5288c1" />
              <Text style={styles.actionMenuBtnText}>
                {selectedConvo?.isMuted ? 'Unmute Chat' : 'Mute Chat'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionMenuBtn, { borderBottomWidth: 0, marginTop: 8 }]}
              onPress={() => setActionMenuVisible(false)}
            >
              <Text style={[styles.actionMenuBtnText, { color: '#e53935', textAlign: 'center' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#17212b',
  },
  inboxRoot: {
    flex: 1,
    backgroundColor: '#17212b',
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    padding: 6,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2b3a4b',
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingVertical: 8,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  adminBar: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#232e3c',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  adminBarTitle: {
    color: '#708499',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  adminBarBtnText: {
    color: '#5288c1',
    fontSize: 13,
    fontWeight: '600',
  },
  archiveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  archiveHeaderText: {
    color: '#5288c1',
    fontSize: 14,
    fontWeight: '600',
  },
  itemRow: {
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  details: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  timeText: {
    fontSize: 12,
    color: '#708499',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewText: {
    fontSize: 14,
    color: '#708499',
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#5288c1',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#232e3c',
    borderRadius: 12,
    width: '80%',
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  actionMenuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  actionMenuBtnText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  rowActionBtn: {
    padding: 8,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
