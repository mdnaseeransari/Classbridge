import React, { useState, useEffect, useRef, useContext } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StatusBar,
  Modal,
  Animated,
  LayoutAnimation,
  Image,
  Linking,
  Dimensions,
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Avatar from '../../components/ui/Avatar';

const EMOJIS = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];

/** Subtle dot-grid wallpaper rendered behind the chat messages */
const WallpaperBackground = () => {
  const DOT_SIZE = 2;
  const SPACING = 22;
  const COLS = 20;
  const ROWS = 40;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {Array.from({ length: ROWS }).map((_, row) =>
        Array.from({ length: COLS }).map((__, col) => (
          <View
            key={`dot-${row}-${col}`}
            style={{
              position: 'absolute',
              top: row * SPACING,
              left: col * SPACING,
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: DOT_SIZE / 2,
              backgroundColor: 'rgba(148, 163, 184, 0.08)',
            }}
          />
        ))
      )}
    </View>
  );
};

export default function ChatRoomScreen({ route, navigation, isInline }) {
  const { conversationId, title } = route.params;
  const { user } = useContext(AuthContext);

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [animatingDeleteIds, setAnimatingDeleteIds] = useState(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [activeConversations, setActiveConversations] = useState([]);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [selectedActionMessage, setSelectedActionMessage] = useState(null);
  const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchBarVisible, setSearchBarVisible] = useState(false);
  const [searching, setSearching] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [lastSeenMap, setLastSeenMap] = useState({});
  const [sharedMediaVisible, setSharedMediaVisible] = useState(false);
  const [sharedMediaTab, setSharedMediaTab] = useState('media'); // 'media' | 'docs' | 'links'
  const [imageViewerUrl, setImageViewerUrl] = useState(null); // full-screen image viewer
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportingMsgId, setReportingMsgId] = useState(null);


  const typingTimeoutRef = useRef(null);
  const socketRef = useRef(null);
  const flatListRef = useRef(null);

  const handleSearch = async (text) => {
    setSearchQuery(text);
    if (!text || !text.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      setSearching(true);
      const res = await api.get(`/chat/conversations/${conversationId}/search`, {
        params: { q: text },
      });
      setSearchResults(res.data.messages || []);
    } catch (_err) {
      // silent fail
    } finally {
      setSearching(false);
    }
  };

  const toggleSearchBar = () => {
    if (searchBarVisible) {
      setSearchQuery('');
      setSearchResults(null);
      setSearchBarVisible(false);
    } else {
      setSearchBarVisible(true);
    }
  };

  const isGroup = conversation?.type === 'group';
  const isAdminUser = ['admin', 'superadmin'].includes(user?.role);

  useEffect(() => {
    socketRef.current = getSocket();

    const fetchConvoDetails = async () => {
      try {
        const res = await api.get(`/chat/conversations/${conversationId}`);
        const convo = res.data.conversation;
        setConversation(convo);
        // Seed online status and last seen from DB data immediately (no socket roundtrip needed)
        if (convo.participants) {
          const seedOnline = {};
          const seedLastSeen = {};
          convo.participants.forEach((p) => {
            if (p._id !== user?._id) {
              seedOnline[p._id] = !!p.isOnline;
              if (p.lastSeenAt) seedLastSeen[p._id] = p.lastSeenAt;
            }
          });
          setOnlineUsers((prev) => ({ ...prev, ...seedOnline }));
          setLastSeenMap((prev) => ({ ...prev, ...seedLastSeen }));
        }
        // Also try socket ACK for live accuracy
        if (convo.type === 'direct' && socketRef.current) {
          const other = convo.participants.find((p) => p._id !== user?._id);
          if (other) {
            socketRef.current.emit('get_online_status', { userIds: [other._id] }, (resAck) => {
              if (resAck && resAck.statuses) {
                setOnlineUsers((prev) => ({ ...prev, ...resAck.statuses }));
              }
              if (resAck && resAck.lastSeenMap) {
                setLastSeenMap((prev) => ({ ...prev, ...resAck.lastSeenMap }));
              }
            });
          }
        }
      } catch (_err) {
        // silent fail
      }
    };

    const fetchMessages = async () => {
      try {
        const res = await api.get(`/chat/conversations/${conversationId}/messages`, { params: { page: 1 } });
        const fetched = res.data.messages || [];
        setMessages([...fetched].reverse());
        setHasMore(fetched.length === 50);
      } catch (_err) {
        // silent fail
      } finally {
        setLoading(false);
      }
    };

    fetchConvoDetails();
    fetchMessages();

    const onMessageReceived = (newMsg) => {
      if (newMsg.conversation === conversationId) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setMessages((prev) => {
          const now = new Date(newMsg.createdAt).getTime();
          const isDuplicate = prev.some(
            (m) =>
              String(m.sender?._id) === String(newMsg.sender?._id) &&
              m.content === newMsg.content &&
              Math.abs(new Date(m.createdAt).getTime() - now) < 2000
          );
          if (isDuplicate) {
            // This ensures subsequent operations like reporting utilize the correct database ID.
            return prev.map((m) =>
              String(m.sender?._id) === String(newMsg.sender?._id) &&
                m.content === newMsg.content &&
                /^\d+$/.test(m._id)
                ? newMsg
                : m
            );
          }
          return [newMsg, ...prev];
        });
        if (socketRef.current) {
          socketRef.current.emit('mark_delivered', { conversationId });
          socketRef.current.emit('mark_read', { conversationId });
        }
      }
    };

    const onTyping = ({ conversationId: cId, userId, isTyping: typingStatus }) => {
      if (cId === conversationId && userId !== user?._id) {
        setIsTyping(typingStatus);
      }
    };

    const onMessageEdited = (editedMsg) => {
      if (editedMsg.conversation === conversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === editedMsg._id
              ? {
                ...m,
                content: editedMsg.content,
                isEdited: editedMsg.isEdited,
                editedAt: editedMsg.editedAt,
              }
              : m
          )
        );
      }
    };

    const onMessageDeleted = (deletedInfo) => {
      if (deletedInfo.conversation === conversationId) {
        setAnimatingDeleteIds((prev) => {
          const next = new Set(prev);
          next.add(deletedInfo._id);
          return next;
        });

        setTimeout(() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setMessages((prev) =>
            prev.map((m) =>
              m._id === deletedInfo._id
                ? {
                  ...m,
                  isDeleted: true,
                  deletedBy: deletedInfo.deletedBy,
                  content: null,
                  fileUrl: null,
                  fileName: null,
                  fileMimeType: null,
                  fileSizeBytes: null,
                }
                : m
            )
          );
          setAnimatingDeleteIds((prev) => {
            const next = new Set(prev);
            next.delete(deletedInfo._id);
            return next;
          });
        }, 250);
      }
    };

    const onMessagesRead = ({ readBy }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.sender?._id === user?._id) {
            const alreadyRead = m.readBy?.some((r) => String(r.user) === String(readBy));
            if (!alreadyRead) {
              return {
                ...m,
                readBy: [...(m.readBy || []), { user: readBy, readAt: new Date() }],
              };
            }
          }
          return m;
        })
      );
    };

    const onMessagesDelivered = ({ userId: delUser }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.sender?._id === user?._id) {
            const alreadyDel = m.deliveredTo?.some((r) => String(r.user) === String(delUser));
            if (!alreadyDel) {
              return {
                ...m,
                deliveredTo: [...(m.deliveredTo || []), { user: delUser, deliveredAt: new Date() }],
              };
            }
          }
          return m;
        })
      );
    };

    const onReactionUpdated = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
      );
    };

    const onUserOnline = ({ userId }) => {
      setOnlineUsers((prev) => ({ ...prev, [userId]: true }));
    };

    const onUserOffline = ({ userId, lastSeenAt }) => {
      setOnlineUsers((prev) => ({ ...prev, [userId]: false }));
      if (lastSeenAt) setLastSeenMap((prev) => ({ ...prev, [userId]: lastSeenAt }));
    };

    if (socketRef.current) {
      socketRef.current.emit('join_conversation', { conversationId });
      socketRef.current.emit('mark_delivered', { conversationId });
      socketRef.current.emit('mark_read', { conversationId });

      socketRef.current.on('message_received', onMessageReceived);
      socketRef.current.on('typing', onTyping);
      socketRef.current.on('message_edited', onMessageEdited);
      socketRef.current.on('message_deleted', onMessageDeleted);
      socketRef.current.on('messages_read', onMessagesRead);
      socketRef.current.on('reaction_updated', onReactionUpdated);
      socketRef.current.on('messages_delivered', onMessagesDelivered);
      socketRef.current.on('user_online', onUserOnline);
      socketRef.current.on('user_offline', onUserOffline);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_conversation', { conversationId });
        socketRef.current.off('message_received', onMessageReceived);
        socketRef.current.off('typing', onTyping);
        socketRef.current.off('message_edited', onMessageEdited);
        socketRef.current.off('message_deleted', onMessageDeleted);
        socketRef.current.off('messages_read', onMessagesRead);
        socketRef.current.off('reaction_updated', onReactionUpdated);
        socketRef.current.off('messages_delivered', onMessagesDelivered);
        socketRef.current.off('user_online', onUserOnline);
        socketRef.current.off('user_offline', onUserOffline);
      }
    };
  }, [conversationId]);

  const loadOlderMessages = async () => {
    if (loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    const nextPage = page + 1;
    try {
      const res = await api.get(`/chat/conversations/${conversationId}/messages`, { params: { page: nextPage } });
      const fetched = res.data.messages || [];
      if (fetched.length > 0) {
        setMessages((prev) => [...prev, ...[...fetched].reverse()]);
        setPage(nextPage);
      }
      setHasMore(fetched.length === 50);
    } catch (_err) {
      // silent fail
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleLongPress = (item) => {
    if (item.isDeleted) return; // Do not show actions on deleted messages
    setSelectedActionMessage(item);
    setActionMenuVisible(true);
  };

  const executeDeleteMsg = async (msgId, target = 'me') => {
    // Trigger fade-out/scale animation for both deletion modes
    setAnimatingDeleteIds((prev) => {
      const next = new Set(prev);
      next.add(msgId);
      return next;
    });

    setTimeout(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      if (target === 'me') {
        // Completely remove locally
        setMessages((prev) => prev.filter((m) => m._id !== msgId));
      } else {
        // Soft-delete transition for everyone
        setMessages((prev) =>
          prev.map((m) =>
            m._id === msgId
              ? {
                ...m,
                isDeleted: true,
                deletedBy: user,
                content: null,
                fileUrl: null,
                fileName: null,
                fileMimeType: null,
                fileSizeBytes: null,
              }
              : m
          )
        );
      }

      setAnimatingDeleteIds((prev) => {
        const next = new Set(prev);
        next.delete(msgId);
        return next;
      });
    }, 250);

    try {
      await api.delete(`/chat/messages/${msgId}?target=${target}`);
    } catch (_err) {
      // silent fail
    }
  };

  const confirmDelete = (msgId) => {
    if (isGroup) {
      setDeleteConfirmVisible(true);
    } else {
      executeDeleteMsg(msgId, 'everyone');
    }
  };

  const reportMessage = (msgId) => {
    setReportingMsgId(msgId);
    setReportReason('');
    setReportModalVisible(true);
  };

  const handleForwardSetup = async (item) => {
    setForwardingMessage(item);
    try {
      const res = await api.get('/chat/conversations');
      setActiveConversations(res.data.conversations || []);
      setForwardModalVisible(true);
    } catch (_err) {
      // silent fail
    }
  };

  const executeForward = async (targetConvoId) => {
    if (!forwardingMessage) return;
    const msgId = forwardingMessage._id;
    setForwardModalVisible(false);
    setForwardingMessage(null);
    try {
      await api.post(`/chat/messages/${msgId}/forward`, { conversationId: targetConvoId });
    } catch (_err) {
      // silent fail
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const trimmed = inputText.trim();

    if (editingMessage) {
      // Editing Mode
      const msgId = editingMessage._id;
      // Optimistically update locally
      setMessages((prev) =>
        prev.map((m) => (m._id === msgId ? { ...m, content: trimmed, isEdited: true, editedAt: new Date().toISOString() } : m))
      );
      setEditingMessage(null);
      setInputText('');
      try {
        await api.patch(`/chat/messages/${msgId}`, { content: trimmed });
      } catch (_err) {
        // silent fail
      }
      return;
    }

    if (socketRef.current) {
      // Replying Mode or Standard Mode
      const payload = {
        conversationId,
        content: trimmed,
      };
      if (replyingTo) {
        payload.replyTo = replyingTo._id;
      }
      socketRef.current.emit('send_message', payload);

      const optimisticMsg = {
        _id: Date.now().toString(),
        conversation: conversationId,
        content: trimmed,
        type: 'text',
        createdAt: new Date().toISOString(),
        sender: { _id: user._id, name: user.name, role: user.role },
        readBy: [],
        replyTo: replyingTo
          ? {
            _id: replyingTo._id,
            content: replyingTo.content,
            type: replyingTo.type,
            fileName: replyingTo.fileName,
            fileUrl: replyingTo.fileUrl,
            sender: replyingTo.sender
              ? {
                _id: replyingTo.sender._id,
                name: replyingTo.sender.name,
                role: replyingTo.sender.role,
              }
              : null,
          }
          : null,
      };
      setMessages((prev) => [optimisticMsg, ...prev]);
    }

    setReplyingTo(null);
    setInputText('');
    handleTypingStop();
  };

  const handleAttachmentPress = () => {
    setAttachmentMenuVisible(true);
  };

  const pickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) return;

      await uploadFile(asset.uri, asset.fileName || 'image.jpg', asset.mimeType || 'image/jpeg');
    } catch (_err) {
      // silent fail
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) return;

      await uploadFile(asset.uri, asset.name || 'document', asset.mimeType || 'application/octet-stream');
    } catch (_err) {
      // silent fail
    }
  };

  const uploadFile = async (uri, name, mimeType) => {
    setUploading(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', blob, name);
      } else {
        formData.append('file', {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name,
          type: mimeType,
        });
      }

      await api.post(`/chat/conversations/${conversationId}/attachment`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } catch (_err) {
      // silent fail
    } finally {
      setUploading(false);
    }
  };

  const handleTypingStart = () => {
    if (socketRef.current) {
      socketRef.current.emit('typing_start', { conversationId });
    }
  };

  const handleTypingStop = () => {
    if (socketRef.current) {
      socketRef.current.emit('typing_stop', { conversationId });
    }
  };

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollBottom(offsetY > 200);
  };

  const handleTextChange = (text) => {
    setInputText(text);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    } else {
      handleTypingStart();
    }

    typingTimeoutRef.current = setTimeout(() => {
      handleTypingStop();
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };

  const selectEmoji = (emoji) => {
    setInputText((prev) => prev + emoji);
  };

  const executeReportMsg = async (msgId, reason) => {
    try {
      await api.post(`/chat/messages/${msgId}/report`, {
        reason: 'other',
        details: reason,
      });
    } catch (_err) {
      // silent fail
    }
  };

  const handleHeaderPress = () => {
    if (isGroup) {
      if (isAdminUser) {
        navigation.navigate('GroupSettings', { conversationId });
      } else {
        navigation.navigate('GroupMemberList', { conversationId, groupName: title });
      }
    } else {
      // For direct chats, open shared media panel
      setSharedMediaVisible(true);
    }
  };

  const handleToggleMute = async () => {
    setHeaderMenuVisible(false);
    try {
      await api.patch(`/chat/conversations/${conversationId}/mute`);
      setConversation((prev) => prev ? { ...prev, isMuted: !prev.isMuted } : prev);
    } catch (_err) {
      // silent fail
    }
  };

  const handleTogglePin = async () => {
    setHeaderMenuVisible(false);
    try {
      await api.patch(`/chat/conversations/${conversationId}/pin`);
      setConversation((prev) => prev ? { ...prev, isPinned: !prev.isPinned } : prev);
    } catch (_err) {
      // silent fail
    }
  };

  const handleArchive = async () => {
    setHeaderMenuVisible(false);
    try {
      await api.patch(`/chat/conversations/${conversationId}/archive`);
      navigation.goBack();
    } catch (_err) {
      // silent fail
    }
  };

  const getMessagePressProps = (item) => {
    if (Platform.OS === 'web') {
      return {
        onContextMenu: (e) => {
          e.preventDefault();
          handleLongPress(item);
        }
      };
    }
    return {
      onLongPress: () => handleLongPress(item),
    };
  };

  const AnimatedBubbleWrapper = ({ children, isDeleting }) => {
    const opacity = useRef(new Animated.Value(1)).current;
    const scale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      if (isDeleting) {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true,
          })
        ]).start();
      }
    }, [isDeleting]);

    return (
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        {children}
      </Animated.View>
    );
  };

  const renderBubble = ({ item, index }) => {
    const isSelf = item.sender?._id === user?._id;
    const formattedTime = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isDeleting = animatingDeleteIds.has(item._id);

    // Grouped bubble: list is inverted so index 0 = newest
    // prevMsg = message displayed BELOW this one (older in array = newer index)
    // nextMsg = message displayed ABOVE this one (newer in array = older index)
    const displayMessages = searchBarVisible && searchResults !== null ? searchResults : messages;
    const prevMsg = displayMessages[index + 1]; // older in time (above visually)
    const nextMsg = displayMessages[index - 1]; // newer in time (below visually)
    const isSameSenderAsPrev = prevMsg && prevMsg.sender?._id === item.sender?._id && !prevMsg.isDeleted;
    const isSameSenderAsNext = nextMsg && nextMsg.sender?._id === item.sender?._id && !nextMsg.isDeleted;
    const isGroupedTop = isSameSenderAsPrev;    // has a message above from same sender
    const isGroupedBottom = isSameSenderAsNext; // has a message below from same sender

    if (item.isDeleted) {
      return (
        <AnimatedBubbleWrapper isDeleting={isDeleting}>
          <View style={[styles.bubbleWrapper, isSelf ? styles.bubbleRight : styles.bubbleLeft, isGroupedBottom && { marginBottom: 2 }]}>
            {isGroup && !isSelf && !isGroupedTop && <Text style={styles.senderName}>{item.sender?.name}</Text>}
            <View style={[styles.bubble, styles.bubbleDeleted]}>
              <Text style={styles.textDeleted}>
                {isGroup
                  ? `This message was deleted by ${item.deletedBy?._id === user?._id ? 'you' : (item.deletedBy?.name || 'someone')}`
                  : 'This message was deleted'}
              </Text>
              <View style={styles.bubbleFooter}>
                <Text style={[styles.bubbleTime, { color: '#64748b' }]}>{formattedTime}</Text>
              </View>
            </View>
          </View>
        </AnimatedBubbleWrapper>
      );
    }

    // Compute grouped corner radii
    const FULL = 16;
    const FLAT = 4;
    let bubbleGroupStyle = {};
    if (isSelf) {
      // Self: tail at bottom-right; flatten top-right when grouped top, flatten bottom-right when grouped bottom
      bubbleGroupStyle = {
        borderTopLeftRadius: FULL,
        borderTopRightRadius: isGroupedTop ? FLAT : FULL,
        borderBottomLeftRadius: FULL,
        borderBottomRightRadius: isGroupedBottom ? FLAT : FLAT,
      };
    } else {
      // Other: tail at bottom-left; flatten top-left when grouped top, flatten bottom-left when grouped bottom
      bubbleGroupStyle = {
        borderTopLeftRadius: isGroupedTop ? FLAT : FULL,
        borderTopRightRadius: FULL,
        borderBottomLeftRadius: isGroupedBottom ? FLAT : FLAT,
        borderBottomRightRadius: FULL,
      };
    }

    return (
      <AnimatedBubbleWrapper isDeleting={isDeleting}>
        <View style={[styles.bubbleWrapper, isSelf ? styles.bubbleRight : styles.bubbleLeft, isGroupedBottom && { marginBottom: 2 }]}>
          {isGroup && !isSelf && !isGroupedTop && <Text style={styles.senderName}>{item.sender?.name}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              activeOpacity={0.9}
              {...getMessagePressProps(item)}
              style={{ flexShrink: 1 }}
            >
              <View style={[styles.bubble, isSelf ? styles.bubbleSelf : styles.bubbleOther, bubbleGroupStyle]}>
                {item.forwardedFrom && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                    <Ionicons name="share-social-outline" size={10} color={isSelf ? 'rgba(255, 255, 255, 0.7)' : '#64748b'} />
                    <Text style={[styles.forwardedIndicator, isSelf ? styles.timeSelf : styles.timeOther, { marginBottom: 0 }]}>
                      Forwarded
                    </Text>
                  </View>
                )}

                {item.replyTo && (
                  <View style={styles.replyQuoteBox}>
                    <Text style={styles.replyQuoteSender}>
                      {item.replyTo.sender?.name || 'User'}
                    </Text>
                    <Text style={styles.replyQuoteContent} numberOfLines={1}>
                      {item.replyTo.type === 'file' ? `📁 ${item.replyTo.fileName || 'Attachment'}` : item.replyTo.content}
                    </Text>
                  </View>
                )}

                {item.type === 'file' ? (() => {
                  const isImage = item.fileMimeType && item.fileMimeType.startsWith('image/');
                  if (isImage && item.fileUrl) {
                    return (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setImageViewerUrl(item.fileUrl)}
                        style={styles.imageBubble}
                      >
                        <Image
                          source={{ uri: item.fileUrl }}
                          style={styles.imageBubbleImg}
                          resizeMode="cover"
                        />
                        {item.content && item.content !== item.fileName && (
                          <Text style={[styles.bubbleText, isSelf ? styles.textSelf : styles.textOther, { marginTop: 6 }]}>
                            {item.content}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  }
                  // Non-image file — show download row
                  return (
                    <TouchableOpacity
                      style={styles.fileRow}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (item.fileUrl) {
                          Linking.openURL(item.fileUrl).catch(() => { });
                        }
                      }}
                    >
                      <View style={[styles.fileIconBox, isSelf && { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                        <Ionicons name="document-outline" size={24} color={isSelf ? '#ffffff' : '#38bdf8'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fileRowName, isSelf ? styles.textSelf : styles.textOther]} numberOfLines={2}>
                          {item.fileName || 'Document'}
                        </Text>
                        {item.fileMimeType && (
                          <Text style={[styles.fileRowMeta, isSelf ? { color: 'rgba(255,255,255,0.55)' } : {}]}>
                            {item.fileMimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                          </Text>
                        )}
                      </View>
                      <Ionicons name="download-outline" size={20} color={isSelf ? 'rgba(255,255,255,0.7)' : '#64748b'} />
                    </TouchableOpacity>
                  );
                })() : (
                  <Text style={[styles.bubbleText, isSelf ? styles.textSelf : styles.textOther]}>{item.content}</Text>
                )}


                {/* Reactions badges */}
                {item.reactions && item.reactions.length > 0 && (
                  <View style={styles.reactionsRow}>
                    {Object.entries(
                      item.reactions.reduce((acc, curr) => {
                        acc[curr.reaction] = (acc[curr.reaction] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([emoji, count]) => {
                      const userReacted = item.reactions.some(r => String(r.user) === String(user?._id) && r.reaction === emoji);
                      return (
                        <TouchableOpacity
                          key={emoji}
                          style={[styles.reactionBadge, userReacted && { borderColor: '#2563eb', borderWidth: 1 }]}
                          onPress={() => {
                            if (userReacted) {
                              socketRef.current?.emit('remove_reaction', { messageId: item._id });
                            } else {
                              socketRef.current?.emit('add_reaction', { messageId: item._id, reaction: emoji });
                            }
                          }}
                        >
                          <Text style={styles.reactionEmoji}>{emoji} {count}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <View style={styles.bubbleFooter}>
                  {item.isEdited && (
                    <Text style={[styles.editedLabel, isSelf ? styles.timeSelf : styles.timeOther]}>edited </Text>
                  )}
                  <Text style={[styles.bubbleTime, isSelf ? styles.timeSelf : styles.timeOther]}>
                    {formattedTime}
                  </Text>
                  {isSelf && (() => {
                    const isRead = item.readBy && item.readBy.some((r) => String(r.user) !== String(user?._id));
                    const isDelivered = item.deliveredTo && item.deliveredTo.some((d) => String(d.user) !== String(user?._id));
                    if (isRead) {
                      return <Ionicons name="checkmark-done" size={13} color="#38bdf8" style={{ marginLeft: 3 }} />;
                    }
                    if (isDelivered) {
                      return <Ionicons name="checkmark-done" size={13} color="rgba(255, 255, 255, 0.7)" style={{ marginLeft: 3 }} />;
                    }
                    return <Ionicons name="checkmark" size={13} color="rgba(255, 255, 255, 0.7)" style={{ marginLeft: 3 }} />;
                  })()}
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleLongPress(item)}
              style={styles.actionDotBtn}
            >
              <Text style={styles.actionDotText}>⋮</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedBubbleWrapper>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <StatusBar barStyle="light-content" backgroundColor="#17212b" />
      <View style={styles.header}>
        {!isInline && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 10 }}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={handleHeaderPress} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ position: 'relative', marginRight: 10 }}>
            <Avatar
              name={title}
              role={isGroup ? 'admin' : (conversation?.participants?.find(p => p._id !== user?._id)?.role || 'student')}
              size="small"
              showOnline={!isGroup && !!onlineUsers[conversation?.participants?.find(p => p._id !== user?._id)?._id]}
            />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Text style={styles.headerTitleText} numberOfLines={1}>
              {conversation?.isMuted && '🔇 '}
              {title}
            </Text>
            {isGroup ? (
              <Text style={styles.headerSubText}>Tap for Info</Text>
            ) : (
              <Text style={styles.headerSubText}>
                {!isGroup && (() => {
                  const otherId = conversation?.participants?.find(p => p._id !== user?._id)?._id;
                  const isOtherOnline = !!onlineUsers[otherId];
                  if (isOtherOnline) return 'Online';
                  const lastSeen = lastSeenMap[otherId];
                  if (!lastSeen) return 'Last seen: recently';
                  const diff = Date.now() - new Date(lastSeen).getTime();
                  const mins = Math.floor(diff / 60000);
                  const hrs = Math.floor(diff / 3600000);
                  const days = Math.floor(diff / 86400000);
                  if (mins < 1) return 'Last seen: just now';
                  if (mins < 60) return `Last seen: ${mins}m ago`;
                  if (hrs < 24) return `Last seen: ${hrs}h ago`;
                  return `Last seen: ${days}d ago`;
                })()}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleSearchBar} style={{ padding: 6 }}>
          <Ionicons name="search" size={20} color="#708499" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setHeaderMenuVisible(true)} style={{ padding: 6, marginLeft: 2 }}>
          <Ionicons name="ellipsis-vertical" size={20} color="#708499" />
        </TouchableOpacity>
      </View>

      {searchBarVisible && (
        <View style={styles.searchBarContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor="#708499"
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus
          />
          <TouchableOpacity onPress={toggleSearchBar} style={{ padding: 6 }}>
            <Ionicons name="close" size={20} color="#e53935" />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#5288c1" />
        </View>
      ) : (
        <View style={{ flex: 1, position: 'relative' }}>
          <WallpaperBackground />
          <FlatList
            ref={flatListRef}
            data={searchBarVisible && searchResults !== null ? searchResults : messages}
            keyExtractor={(item) => item._id}
            renderItem={renderBubble}
            inverted
            onEndReached={loadOlderMessages}
            onEndReachedThreshold={0.2}
            ListFooterComponent={loadingOlder ? <ActivityIndicator color="#5288c1" style={{ marginVertical: 10 }} /> : null}
            contentContainerStyle={styles.listContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            style={[styles.chatBackground, { backgroundColor: 'transparent' }]}
          />
        </View>
      )}

      {isTyping && <Text style={styles.typingIndicator}>typing...</Text>}
      {uploading && (
        <View style={styles.uploadingBox}>
          <ActivityIndicator color="#5288c1" size="small" />
          <Text style={styles.uploadingText}>Uploading attachment (limit 10MB)...</Text>
        </View>
      )}

      {/* Reply Preview Bar */}
      {replyingTo && (
        <View style={styles.previewBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.replyTitle}>Reply to {replyingTo.sender?.name || 'User'}</Text>
            <Text style={styles.previewContent} numberOfLines={1}>
              {replyingTo.type === 'file' ? `📁 ${replyingTo.fileName || 'Attachment'}` : replyingTo.content}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyingTo(null)}>
            <Ionicons name="close" size={18} color="#708499" />
          </TouchableOpacity>
        </View>
      )}

      {/* Editing Preview Bar */}
      {editingMessage && (
        <View style={[styles.previewBar, { borderLeftColor: '#ffa726' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.replyTitle, { color: '#ffa726' }]}>Edit Message</Text>
            <Text style={styles.previewContent} numberOfLines={1}>
              {editingMessage.content}
            </Text>
          </View>
          <TouchableOpacity onPress={() => { setEditingMessage(null); setInputText(''); }}>
            <Ionicons name="close" size={18} color="#708499" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleAttachmentPress}>
          <Ionicons name="attach-outline" size={24} color="#708499" />
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder={editingMessage ? 'Edit message...' : 'Message'}
            placeholderTextColor="#708499"
            value={inputText}
            onChangeText={handleTextChange}
            multiline
          />
          <TouchableOpacity style={styles.emojiBtnInside} onPress={toggleEmojiPicker}>
            <Ionicons name="happy-outline" size={20} color="#708499" />
          </TouchableOpacity>
        </View>

        {inputText.trim().length > 0 || uploading ? (
          <TouchableOpacity style={styles.sendCircleBtn} onPress={handleSend} activeOpacity={0.8}>
            <Ionicons name="arrow-up" size={20} color="#ffffff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8}>
            <Ionicons name="mic-outline" size={24} color="#708499" />
          </TouchableOpacity>
        )}
      </View>

      {/* Emoji Picker Grid */}
      {showEmojiPicker && (
        <View style={styles.emojiPicker}>
          <FlatList
            data={EMOJIS}
            keyExtractor={(item, idx) => idx.toString()}
            numColumns={8}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.emojiCell} onPress={() => selectEmoji(item)}>
                <Text style={styles.emojiText}>{item}</Text>
              </TouchableOpacity>
            )}
            style={{ maxHeight: 200 }}
          />
        </View>
      )}

      {/* Forward Modal */}
      <Modal
        visible={forwardModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setForwardModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Forward Message</Text>
              <TouchableOpacity onPress={() => setForwardModalVisible(false)}>
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={activeConversations}
              keyExtractor={(c) => c._id}
              renderItem={({ item: convo }) => {
                let displayTitle = convo.name || 'Group Chat';
                if (convo.type === 'direct') {
                  const other = convo.participants.find((p) => p._id !== user?._id);
                  displayTitle = other?.name || 'Unknown User';
                }
                return (
                  <TouchableOpacity
                    style={styles.convoItem}
                    onPress={() => executeForward(convo._id)}
                  >
                    <Text style={styles.convoName}>{displayTitle}</Text>
                    <Text style={styles.convoType}>{convo.type.toUpperCase()}</Text>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View style={styles.modalCenter}>
                  <Text style={styles.emptyText}>No active chats to forward to.</Text>
                </View>
              }
              style={{ maxHeight: 400 }}
            />
          </View>
        </View>
      </Modal>

      {/* Action Sheet Modal (Web & Native) */}
      <Modal
        visible={actionMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActionMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { marginBottom: 12 }]}>Message Actions</Text>

            {/* Quick Reactions Bar */}
            <View style={styles.reactionPickerRow}>
              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionPickerItem}
                  onPress={() => {
                    setActionMenuVisible(false);
                    socketRef.current?.emit('add_reaction', {
                      messageId: selectedActionMessage._id,
                      reaction: emoji,
                    });
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.actionMenuBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
              onPress={() => {
                setActionMenuVisible(false);
                setReplyingTo(selectedActionMessage);
                setEditingMessage(null);
              }}
            >
              <Ionicons name="chatbubble-outline" size={18} color="#2563eb" />
              <Text style={styles.actionMenuBtnText}>Reply</Text>
            </TouchableOpacity>

            {selectedActionMessage?.sender?._id === user?._id && selectedActionMessage?.type !== 'file' && (
              <TouchableOpacity
                style={[styles.actionMenuBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
                onPress={() => {
                  setActionMenuVisible(false);
                  setEditingMessage(selectedActionMessage);
                  setInputText(selectedActionMessage.content || '');
                  setReplyingTo(null);
                }}
              >
                <Ionicons name="create-outline" size={18} color="#2563eb" />
                <Text style={styles.actionMenuBtnText}>Edit</Text>
              </TouchableOpacity>
            )}

            {selectedActionMessage && !selectedActionMessage.isDeleted && (
              <TouchableOpacity
                style={[styles.actionMenuBtn, { borderBottomColor: 'rgba(239,68,68,0.2)', flexDirection: 'row', alignItems: 'center', gap: 10 }]}
                onPress={() => {
                  setActionMenuVisible(false);
                  confirmDelete(selectedActionMessage._id);
                }}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                <Text style={[styles.actionMenuBtnText, { color: '#ef4444' }]}>Delete</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionMenuBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
              onPress={() => {
                setActionMenuVisible(false);
                handleForwardSetup(selectedActionMessage);
              }}
            >
              <Ionicons name="arrow-redo-outline" size={18} color="#2563eb" />
              <Text style={styles.actionMenuBtnText}>Forward</Text>
            </TouchableOpacity>

            {selectedActionMessage?.sender?._id !== user?._id && (
              <TouchableOpacity
                style={[styles.actionMenuBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
                onPress={() => {
                  setActionMenuVisible(false);
                  reportMessage(selectedActionMessage._id);
                }}
              >
                <Ionicons name="warning-outline" size={18} color="#ef4444" />
                <Text style={[styles.actionMenuBtnText, { color: '#ef4444' }]}>Report</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionMenuBtn, { borderBottomWidth: 0, marginTop: 12 }]}
              onPress={() => setActionMenuVisible(false)}
            >
              <Text style={[styles.actionMenuBtnText, { color: '#64748b', textAlign: 'center' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Web Attachment Menu Modal */}
      {Platform.OS === 'web' && (
        <Modal
          visible={attachmentMenuVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setAttachmentMenuVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={[styles.modalTitle, { marginBottom: 12 }]}>Send Attachment</Text>

              <TouchableOpacity
                style={[styles.actionMenuBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
                onPress={() => {
                  setAttachmentMenuVisible(false);
                  pickImage();
                }}
              >
                <Ionicons name="image-outline" size={18} color="#2563eb" />
                <Text style={styles.actionMenuBtnText}>Image / Video</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionMenuBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
                onPress={() => {
                  setAttachmentMenuVisible(false);
                  pickDocument();
                }}
              >
                <Ionicons name="document-text-outline" size={18} color="#2563eb" />
                <Text style={styles.actionMenuBtnText}>Document</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionMenuBtn, { borderBottomWidth: 0, marginTop: 12 }]}
                onPress={() => setAttachmentMenuVisible(false)}
              >
                <Text style={[styles.actionMenuBtnText, { color: '#64748b', textAlign: 'center' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <TouchableOpacity
          style={styles.scrollBottomBtn}
          activeOpacity={0.8}
          onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
        >
          <Ionicons name="chevron-down" size={20} color="#ffffff" />
        </TouchableOpacity>
      )}

      {/* ── Full-Screen Image Viewer ───────────────────────────────────── */}
      <Modal
        visible={!!imageViewerUrl}
        animationType="fade"
        transparent
        onRequestClose={() => setImageViewerUrl(null)}
        statusBarTranslucent
      >
        <View style={styles.imageViewerOverlay}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.imageViewerClose}
            onPress={() => setImageViewerUrl(null)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={26} color="#ffffff" />
          </TouchableOpacity>

          {/* Image */}
          {imageViewerUrl && (
            <Image
              source={{ uri: imageViewerUrl }}
              style={styles.imageViewerImg}
              resizeMode="contain"
            />
          )}

          {/* Bottom actions */}
          <View style={styles.imageViewerActions}>
            <TouchableOpacity
              style={styles.imageViewerBtn}
              onPress={() => {
                if (imageViewerUrl) {
                  Linking.openURL(imageViewerUrl).catch(() => { });
                }
              }}
            >
              <Ionicons name="download-outline" size={20} color="#ffffff" />
              <Text style={styles.imageViewerBtnText}>Download / Open</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Shared Media Panel ─────────────────────────────────────────── */}

      <Modal
        visible={sharedMediaVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSharedMediaVisible(false)}
      >
        <View style={styles.sharedMediaOverlay}>
          <View style={styles.sharedMediaPanel}>
            {/* Header */}
            <View style={styles.sharedMediaHeader}>
              <Text style={styles.sharedMediaTitle}>Shared Content</Text>
              <TouchableOpacity onPress={() => setSharedMediaVisible(false)} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.sharedMediaTabs}>
              {['media', 'docs', 'links'].map((tab) => {
                const icons = { media: 'images-outline', docs: 'document-outline', links: 'link-outline' };
                const labels = { media: 'Media', docs: 'Docs', links: 'Links' };
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.sharedMediaTabBtn, sharedMediaTab === tab && styles.sharedMediaTabActive]}
                    onPress={() => setSharedMediaTab(tab)}
                  >
                    <Ionicons name={icons[tab]} size={16} color={sharedMediaTab === tab ? '#38bdf8' : '#64748b'} />
                    <Text style={[styles.sharedMediaTabText, sharedMediaTab === tab && { color: '#38bdf8' }]}>
                      {labels[tab]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Content */}
            {(() => {
              const allMsgs = messages.filter((m) => !m.isDeleted);
              if (sharedMediaTab === 'media') {
                // Images are file messages with image mimetypes
                const mediaItems = allMsgs.filter(
                  (m) => m.type === 'file' && m.fileMimeType && m.fileMimeType.startsWith('image/')
                );
                if (!mediaItems.length) {
                  return (
                    <View style={styles.sharedMediaEmpty}>
                      <Ionicons name="images-outline" size={48} color="#1e293b" />
                      <Text style={styles.sharedMediaEmptyText}>No media shared yet</Text>
                    </View>
                  );
                }
                return (
                  <FlatList
                    data={mediaItems}
                    keyExtractor={(i) => i._id}
                    numColumns={3}
                    contentContainerStyle={{ padding: 4 }}
                    renderItem={({ item: mediaMsg }) => (
                      <TouchableOpacity
                        style={styles.sharedMediaThumb}
                        onPress={() => {
                          setSharedMediaVisible(false);
                          setTimeout(() => setImageViewerUrl(mediaMsg.fileUrl), 300);
                        }}
                      >
                        <Image
                          source={{ uri: mediaMsg.fileUrl }}
                          style={[styles.sharedMediaThumb, { backgroundColor: '#182533' }]}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    )}
                  />
                );
              }

              if (sharedMediaTab === 'docs') {
                const docItems = allMsgs.filter(
                  (m) => m.type === 'file' && m.fileMimeType && !m.fileMimeType.startsWith('image/')
                );
                if (!docItems.length) {
                  return (
                    <View style={styles.sharedMediaEmpty}>
                      <Ionicons name="document-outline" size={48} color="#1e293b" />
                      <Text style={styles.sharedMediaEmptyText}>No documents shared yet</Text>
                    </View>
                  );
                }
                return (
                  <FlatList
                    data={docItems}
                    keyExtractor={(i) => i._id}
                    contentContainerStyle={{ padding: 12 }}
                    renderItem={({ item: docMsg }) => (
                      <TouchableOpacity
                        style={styles.sharedDocRow}
                        onPress={() => {
                          if (docMsg.fileUrl) {
                            Linking.openURL(docMsg.fileUrl).catch(() => { });
                          }
                        }}
                      >
                        <View style={styles.sharedDocIcon}>
                          <Ionicons name="document-text-outline" size={22} color="#38bdf8" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sharedDocName} numberOfLines={1}>{docMsg.fileName || 'Document'}</Text>
                          <Text style={styles.sharedDocMeta}>
                            {docMsg.sender?.name} · {new Date(docMsg.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                        <Ionicons name="download-outline" size={18} color="#64748b" />
                      </TouchableOpacity>
                    )}
                    ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#1e293b' }} />}
                  />
                );
              }

              if (sharedMediaTab === 'links') {
                const urlRegex = /https?:\/\/[^\s]+/g;
                const linkItems = [];
                allMsgs.forEach((m) => {
                  if (m.type === 'text' && m.content) {
                    const found = m.content.match(urlRegex);
                    found?.forEach((url) => linkItems.push({ _id: `${m._id}-${url}`, url, sender: m.sender, createdAt: m.createdAt }));
                  }
                });
                if (!linkItems.length) {
                  return (
                    <View style={styles.sharedMediaEmpty}>
                      <Ionicons name="link-outline" size={48} color="#1e293b" />
                      <Text style={styles.sharedMediaEmptyText}>No links shared yet</Text>
                    </View>
                  );
                }
                return (
                  <FlatList
                    data={linkItems}
                    keyExtractor={(i) => i._id}
                    contentContainerStyle={{ padding: 12 }}
                    renderItem={({ item: linkMsg }) => (
                      <TouchableOpacity
                        style={styles.sharedDocRow}
                        onPress={() => {
                          if (linkMsg.url) {
                            Linking.openURL(linkMsg.url).catch(() => { });
                          }
                        }}
                      >
                        <View style={[styles.sharedDocIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                          <Ionicons name="globe-outline" size={22} color="#10b981" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sharedDocName} numberOfLines={1}>{linkMsg.url}</Text>
                          <Text style={styles.sharedDocMeta}>
                            {linkMsg.sender?.name} · {new Date(linkMsg.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#1e293b' }} />}
                  />
                );
              }

              return null;
            })()}
          </View>
        </View>
      </Modal>

      {/* Header Three-Dot Menu Modal */}
      <Modal
        visible={headerMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setHeaderMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chat Options</Text>
              <TouchableOpacity onPress={() => setHeaderMenuVisible(false)}>
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.actionMenuBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
              onPress={handleToggleMute}
            >
              <Ionicons name={conversation?.isMuted ? 'volume-high-outline' : 'volume-mute-outline'} size={18} color="#2563eb" />
              <Text style={styles.actionMenuBtnText}>{conversation?.isMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionMenuBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
              onPress={handleTogglePin}
            >
              <Ionicons name={conversation?.isPinned ? 'pin-outline' : 'pin-outline'} size={18} color="#2563eb" />
              <Text style={styles.actionMenuBtnText}>{conversation?.isPinned ? 'Unpin Chat' : 'Pin Chat'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionMenuBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
              onPress={handleArchive}
            >
              <Ionicons name="archive-outline" size={18} color="#ef4444" />
              <Text style={[styles.actionMenuBtnText, { color: '#ef4444' }]}>Archive Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionMenuBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
              onPress={() => {
                setHeaderMenuVisible(false);
                setSharedMediaVisible(true);
              }}
            >
              <Ionicons name="images-outline" size={18} color="#2563eb" />
              <Text style={styles.actionMenuBtnText}>Shared Media</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionMenuBtn, { borderBottomWidth: 0, marginTop: 12 }]}
              onPress={() => setHeaderMenuVisible(false)}
            >
              <Text style={[styles.actionMenuBtnText, { color: '#64748b', textAlign: 'center' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Delete Confirmation Modal */}
      <Modal
        visible={deleteConfirmVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { marginBottom: 12 }]}>Delete Message</Text>
            <Text style={{ color: '#708499', fontSize: 14, marginBottom: 20 }}>
              Do you want to delete this message for everyone or only for yourself?
            </Text>

            <TouchableOpacity
              style={[styles.actionMenuBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
              onPress={() => {
                setDeleteConfirmVisible(false);
                executeDeleteMsg(selectedActionMessage?._id, 'me');
              }}
            >
              <Ionicons name="person-outline" size={18} color="#2563eb" />
              <Text style={styles.actionMenuBtnText}>Delete for Me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionMenuBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
              onPress={() => {
                setDeleteConfirmVisible(false);
                executeDeleteMsg(selectedActionMessage?._id, 'everyone');
              }}
            >
              <Ionicons name="people-outline" size={18} color="#ef4444" />
              <Text style={[styles.actionMenuBtnText, { color: '#ef4444' }]}>Delete for Everyone</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionMenuBtn, { borderBottomWidth: 0, marginTop: 12 }]}
              onPress={() => setDeleteConfirmVisible(false)}
            >
              <Text style={[styles.actionMenuBtnText, { color: '#64748b', textAlign: 'center' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Report Message Modal */}
      <Modal
        visible={reportModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setReportModalVisible(false);
          setReportReason('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { marginBottom: 12 }]}>Report Message</Text>
            <Text style={{ color: '#708499', fontSize: 14, marginBottom: 12 }}>
              Please state the reason for reporting this message:
            </Text>

            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: '#17212b',
                  borderColor: '#1e293b',
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 10,
                  color: '#ffffff',
                  minHeight: 60,
                  marginBottom: 16,
                  textAlignVertical: 'top',
                }
              ]}
              placeholder="Type reason here..."
              placeholderTextColor="#708499"
              value={reportReason}
              onChangeText={setReportReason}
              multiline
            />

            <TouchableOpacity
              style={[styles.actionMenuBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
              onPress={() => {
                if (reportReason.trim()) {
                  executeReportMsg(reportingMsgId, reportReason.trim());
                }
                setReportModalVisible(false);
                setReportReason('');
              }}
            >
              <Ionicons name="send-outline" size={18} color="#2563eb" />
              <Text style={styles.actionMenuBtnText}>Submit Report</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionMenuBtn, { borderBottomWidth: 0, marginTop: 12 }]}
              onPress={() => {
                setReportModalVisible(false);
                setReportReason('');
              }}
            >
              <Text style={[styles.actionMenuBtnText, { color: '#64748b', textAlign: 'center' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>

  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#17212b' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#17212b',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  headerSubText: {
    fontSize: 12,
    color: '#708499',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 12, paddingVertical: 8 },
  bubbleWrapper: { marginBottom: 4, maxWidth: '75%' },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end' },
  senderName: { fontSize: 12, fontWeight: '600', color: '#5288c1', marginBottom: 2, marginLeft: 4 },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, position: 'relative' },
  chatBackground: {
    backgroundColor: '#17212b',
  },
  bubbleSelf: {
    backgroundColor: '#2b5278',
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#232e3c',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, color: '#ffffff' },
  textSelf: { color: '#ffffff' },
  textOther: { color: '#ffffff' },
  bubbleTime: { fontSize: 11, color: '#708499', alignSelf: 'flex-end' },
  timeSelf: { color: '#708499' },
  timeOther: { color: '#708499' },
  typingIndicator: { fontSize: 12, fontStyle: 'italic', color: '#708499', paddingHorizontal: 16, paddingVertical: 4 },
  inputBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#232e3c',
    borderTopWidth: 1,
    borderTopColor: '#0e1621',
  },
  iconBtn: { padding: 8 },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2b3a4b',
    borderRadius: 22,
    height: 44,
    paddingHorizontal: 12,
    marginHorizontal: 8,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    maxHeight: 80,
    paddingVertical: 8,
    paddingHorizontal: 8,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  emojiBtnInside: { padding: 4 },
  sendCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#5288c1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyQuoteBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#5288c1',
    paddingLeft: 8,
    marginBottom: 4,
  },
  replyQuoteSender: { fontSize: 12, fontWeight: '600', color: '#5288c1' },
  replyQuoteContent: { fontSize: 12, color: '#708499' },
  previewBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#232e3c',
    borderTopWidth: 1,
    borderTopColor: '#0e1621',
    borderLeftWidth: 3,
    borderLeftColor: '#5288c1',
    paddingHorizontal: 12,
  },
  replyTitle: { fontSize: 12, fontWeight: '600', color: '#5288c1' },
  previewContent: { fontSize: 12, color: '#708499' },
  emojiPicker: { backgroundColor: '#111827', borderTopWidth: 1, borderTopColor: '#1e293b', padding: 8 },
  emojiCell: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  emojiText: { fontSize: 24 },
  headerSub: { fontSize: 10, color: '#64748b', marginTop: 2, fontWeight: '600' },
  fileText: { fontSize: 15, fontWeight: 'bold', textDecorationLine: 'underline' },
  // Image bubble in chat
  imageBubble: {
    borderRadius: 10,
    overflow: 'hidden',
    marginVertical: 2,
  },
  imageBubbleImg: {
    width: 220,
    height: 180,
    borderRadius: 10,
  },
  // Non-image file row
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    minWidth: 180,
    maxWidth: 240,
  },
  fileIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileRowName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  fileRowMeta: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Full-screen image viewer
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  imageViewerImg: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.75,
  },
  imageViewerActions: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  imageViewerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  imageViewerBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },

  uploadingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', paddingVertical: 8, paddingHorizontal: 16, gap: 10, borderTopWidth: 1, borderTopColor: '#1e293b' },
  uploadingText: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 },
  editedLabel: { fontSize: 8, fontStyle: 'italic' },
  bubbleDeleted: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1e293b', opacity: 0.6, borderBottomRightRadius: 20, borderBottomLeftRadius: 20 },
  textDeleted: { color: '#64748b', fontStyle: 'italic', fontSize: 14 },
  forwardedIndicator: { fontSize: 9, fontStyle: 'italic', marginBottom: 4 },
  replyQuoteBox: { backgroundColor: 'rgba(0,0,0,0.2)', borderLeftWidth: 3, borderLeftColor: '#2563eb', padding: 6, borderRadius: 4, marginBottom: 6 },
  replyQuoteSender: { fontSize: 11, fontWeight: '700', color: '#2563eb', marginBottom: 2 },
  replyQuoteContent: { fontSize: 12, color: '#64748b' },
  previewBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', borderTopWidth: 1, borderTopColor: '#1e293b', paddingHorizontal: 16, paddingVertical: 8 },
  previewTitle: { fontSize: 11, fontWeight: '700', color: '#2563eb', marginBottom: 2 },
  previewContent: { fontSize: 13, color: '#64748b' },
  previewClose: { fontSize: 16, color: '#64748b', fontWeight: '700', paddingHorizontal: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#111827', borderRadius: 12, width: '85%', padding: 20, borderWidth: 1, borderColor: '#1e293b' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#f1f5f9' },
  closeText: { fontSize: 14, color: '#ef4444', fontWeight: '700' },
  convoItem: { paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convoName: { fontSize: 14, color: '#f1f5f9', fontWeight: '600' },
  convoType: { fontSize: 10, color: '#64748b', fontWeight: '700' },
  separator: { height: 1, backgroundColor: '#1e293b' },
  modalCenter: { paddingVertical: 20, alignItems: 'center' },
  actionDotBtn: {
    padding: 4,
    justifyContent: 'center',
    alignSelf: 'center',
    marginLeft: 4,
    opacity: 0.5
  },
  actionDotText: {
    color: '#64748b',
    fontSize: 18,
    fontWeight: '800'
  },
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
  reactionPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    marginBottom: 10,
  },
  reactionPickerItem: {
    padding: 6,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
    marginBottom: 2,
  },
  reactionBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: 12,
    color: '#f1f5f9',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  headerOnlineDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    borderWidth: 1.5,
    borderColor: '#111827',
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  headerSubText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#0a0e1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f1f5f9',
    fontSize: 14,
    marginRight: 8,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  scrollBottomBtn: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 9999,
  },
  // ── Shared Media Panel ────────────────────────────────────────────────────
  sharedMediaOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sharedMediaPanel: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '75%',
    borderTopWidth: 1,
    borderColor: '#1e293b',
  },
  sharedMediaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  sharedMediaTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  sharedMediaTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  sharedMediaTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  sharedMediaTabActive: {
    borderBottomColor: '#38bdf8',
  },
  sharedMediaTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  sharedMediaEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  sharedMediaEmptyText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  sharedMediaThumb: {
    flex: 1,
    margin: 2,
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  sharedDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  sharedDocIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sharedDocName: {
    fontSize: 14,
    color: '#f1f5f9',
    fontWeight: '600',
    marginBottom: 3,
  },
  sharedDocMeta: {
    fontSize: 11,
    color: '#64748b',
  },
});

