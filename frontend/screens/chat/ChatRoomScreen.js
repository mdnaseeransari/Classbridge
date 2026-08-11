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
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

const EMOJIS = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];

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
    } catch (err) {
      console.error('[CHAT_ROOM] Search error:', err);
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
        if (convo.type === 'direct' && socketRef.current) {
          const other = convo.participants.find((p) => p._id !== user?._id);
          if (other) {
            socketRef.current.emit('get_online_status', { userIds: [other._id] }, (resAck) => {
              if (resAck && resAck.statuses) {
                setOnlineUsers((prev) => ({ ...prev, ...resAck.statuses }));
              }
            });
          }
        }
      } catch (err) {
        console.error('[CHAT_ROOM] Error loading conversation details:', err);
      }
    };

    const fetchMessages = async () => {
      try {
        const res = await api.get(`/chat/conversations/${conversationId}/messages`, { params: { page: 1 } });
        const fetched = res.data.messages || [];
        setMessages([...fetched].reverse());
        setHasMore(fetched.length === 50);
      } catch (err) {
        console.error('[CHAT_ROOM] Error loading messages:', err);
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

    const onUserOffline = ({ userId }) => {
      setOnlineUsers((prev) => ({ ...prev, [userId]: false }));
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
    } catch (err) {
      console.error('[CHAT_ROOM] Error loading older messages:', err);
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleLongPress = (item) => {
    if (item.isDeleted) return; // Do not show actions on deleted messages
    setSelectedActionMessage(item);
    setActionMenuVisible(true);
  };

  const executeDeleteMsg = async (msgId) => {
    setAnimatingDeleteIds((prev) => {
      const next = new Set(prev);
      next.add(msgId);
      return next;
    });

    setTimeout(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMessages((prev) =>
        prev.map((m) =>
          m._id === msgId
            ? {
                ...m,
                isDeleted: true,
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
        next.delete(msgId);
        return next;
      });
    }, 250);

    try {
      await api.delete(`/chat/messages/${msgId}`);
    } catch (err) {
      if (Platform.OS === 'web') {
        alert(err?.response?.data?.error || 'Failed to delete message.');
      } else {
        Alert.alert('Error', err?.response?.data?.error || 'Failed to delete message.');
      }
    }
  };

  const confirmDelete = (msgId) => {
    if (Platform.OS === 'web') {
      const confirmAction = window.confirm('Are you sure you want to delete this message?');
      if (confirmAction) {
        executeDeleteMsg(msgId);
      }
      return;
    }
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => executeDeleteMsg(msgId),
        },
      ]
    );
  };

  const handleForwardSetup = async (item) => {
    setForwardingMessage(item);
    try {
      const res = await api.get('/chat/conversations');
      setActiveConversations(res.data.conversations || []);
      setForwardModalVisible(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to retrieve active conversations.');
    }
  };

  const executeForward = async (targetConvoId) => {
    if (!forwardingMessage) return;
    const msgId = forwardingMessage._id;
    setForwardModalVisible(false);
    setForwardingMessage(null);
    try {
      await api.post(`/chat/messages/${msgId}/forward`, { conversationId: targetConvoId });
      Alert.alert('Success', 'Message forwarded successfully.');
    } catch (err) {
      Alert.alert('Forward Failed', err?.response?.data?.error || 'Failed to forward message.');
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
      } catch (err) {
        Alert.alert('Error', err?.response?.data?.error || 'Failed to edit message.');
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
    if (Platform.OS === 'web') {
      setAttachmentMenuVisible(true);
      return;
    }
    Alert.alert(
      'Send Attachment',
      'Select the attachment type:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Image / Video', onPress: pickImage },
        { text: 'Document', onPress: pickDocument },
      ]
    );
  };

  const pickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
          Alert.alert('Permission Denied', 'Permission to access camera roll is required.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Maximum file size permitted is 10 MB.');
        return;
      }

      await uploadFile(asset.uri, asset.fileName || 'image.jpg', asset.mimeType || 'image/jpeg');
    } catch (err) {
      console.error('[ATTACHMENT] Pick image error:', err);
      Alert.alert('Error', 'Failed to pick image.');
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
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Maximum file size permitted is 10 MB.');
        return;
      }

      await uploadFile(asset.uri, asset.name || 'document', asset.mimeType || 'application/octet-stream');
    } catch (err) {
      console.error('[ATTACHMENT] Pick document error:', err);
      Alert.alert('Error', 'Failed to pick document.');
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
    } catch (err) {
      console.error('[ATTACHMENT] Upload error:', err?.response?.data || err.message);
      Alert.alert('Upload Failed', err?.response?.data?.error || 'Failed to upload attachment.');
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
      if (Platform.OS === 'web') {
        alert('Thank you. The administrators will review this message shortly.');
      } else {
        Alert.alert('Report Submitted', 'Thank you. The administrators will review this message shortly.');
      }
    } catch (err) {
      if (Platform.OS === 'web') {
        alert(err?.response?.data?.error || 'Failed to submit report.');
      } else {
        Alert.alert('Error', err?.response?.data?.error || 'Failed to submit report.');
      }
    }
  };

  const reportMessage = (msgId) => {
    if (Platform.OS === 'web') {
      const reason = window.prompt('Please state the reason for reporting this message:');
      if (reason) {
        executeReportMsg(msgId, reason);
      }
      return;
    }
    Alert.prompt(
      'Report Message',
      'Please state the reason for reporting this message:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          onPress: (reason) => {
            if (reason) {
              executeReportMsg(msgId, reason);
            }
          },
        },
      ]
    );
  };

  const handleHeaderPress = () => {
    if (isGroup) {
      if (isAdminUser) {
        navigation.navigate('GroupSettings', { conversationId });
      } else {
        navigation.navigate('GroupMemberList', { conversationId, groupName: title });
      }
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

  const renderBubble = ({ item }) => {
    const isSelf = item.sender?._id === user?._id;
    const formattedTime = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isDeleting = animatingDeleteIds.has(item._id);

    if (item.isDeleted) {
      return (
        <AnimatedBubbleWrapper isDeleting={isDeleting}>
          <View style={[styles.bubbleWrapper, isSelf ? styles.bubbleRight : styles.bubbleLeft]}>
            {isGroup && !isSelf && <Text style={styles.senderName}>{item.sender?.name}</Text>}
            <View style={[styles.bubble, styles.bubbleDeleted]}>
              <Text style={styles.textDeleted}>This message was deleted</Text>
              <View style={styles.bubbleFooter}>
                <Text style={[styles.bubbleTime, { color: '#64748b' }]}>{formattedTime}</Text>
              </View>
            </View>
          </View>
        </AnimatedBubbleWrapper>
      );
    }

    return (
      <AnimatedBubbleWrapper isDeleting={isDeleting}>
        <View style={[styles.bubbleWrapper, isSelf ? styles.bubbleRight : styles.bubbleLeft]}>
          {isGroup && !isSelf && <Text style={styles.senderName}>{item.sender?.name}</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              activeOpacity={0.9}
              {...getMessagePressProps(item)}
              style={{ flexShrink: 1 }}
            >
              <View style={[styles.bubble, isSelf ? styles.bubbleSelf : styles.bubbleOther]}>
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

            {item.type === 'file' ? (
              <TouchableOpacity onPress={() => Alert.alert('Attachment Link', `File URL:\n${item.fileUrl}`)}>
                <Text style={[styles.fileText, isSelf ? styles.textSelf : styles.textOther]}>
                  📁 {item.fileName || 'Attachment'}
                </Text>
                {item.content && item.content !== item.fileName && (
                  <Text style={[styles.bubbleText, isSelf ? styles.textSelf : styles.textOther, { marginTop: 4 }]}>
                    {item.content}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
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
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.header}>
        {!isInline && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}>
            <Ionicons name="arrow-back" size={24} color="#2563eb" />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity onPress={handleHeaderPress} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ position: 'relative', marginRight: 10 }}>
            <View style={[styles.headerAvatar, { backgroundColor: isGroup ? 'rgba(124, 58, 237, 0.1)' : 'rgba(37, 99, 235, 0.1)' }]}>
              <Text style={[styles.headerAvatarText, { color: isGroup ? '#7c3aed' : '#2563eb' }]}>
                {title[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            {!isGroup && !!onlineUsers[conversation?.participants?.find(p => p._id !== user?._id)?._id] && (
              <View style={styles.headerOnlineDot} />
            )}
          </View>
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <Text style={styles.headerTitleText} numberOfLines={1}>
              {conversation?.isMuted && '🔇 '}
              {title}
            </Text>
            {isGroup ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <Ionicons name="information-circle-outline" size={13} color="#64748b" />
                <Text style={styles.headerSubText}>Tap for Info</Text>
              </View>
            ) : (
              <Text style={styles.headerSubText}>
                {!!onlineUsers[conversation?.participants?.find(p => p._id !== user?._id)?._id] ? 'Online' : 'Offline'}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleSearchBar} style={{ padding: 8 }}>
          <Ionicons name="search" size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {searchBarVisible && (
        <View style={styles.searchBarContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus
          />
          <TouchableOpacity onPress={toggleSearchBar} style={{ padding: 8 }}>
            <Ionicons name="close" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={searchBarVisible && searchResults !== null ? searchResults : messages}
          keyExtractor={(item) => item._id}
          renderItem={renderBubble}
          inverted
          onEndReached={loadOlderMessages}
          onEndReachedThreshold={0.2}
          ListFooterComponent={loadingOlder ? <ActivityIndicator color="#38bdf8" style={{ marginVertical: 10 }} /> : null}
          contentContainerStyle={styles.listContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
      )}

      {isTyping && <Text style={styles.typingIndicator}>typing...</Text>}
      {uploading && (
        <View style={styles.uploadingBox}>
          <ActivityIndicator color="#38bdf8" size="small" />
          <Text style={styles.uploadingText}>Uploading attachment (limit 10MB)...</Text>
        </View>
      )}

      {/* Reply Preview Bar */}
      {replyingTo && (
        <View style={styles.previewBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.previewTitle}>Reply to {replyingTo.sender?.name || 'User'}</Text>
            <Text style={styles.previewContent} numberOfLines={1}>
              {replyingTo.type === 'file' ? `📁 ${replyingTo.fileName || 'Attachment'}` : replyingTo.content}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyingTo(null)}>
            <Ionicons name="close" size={18} color="#64748b" />
          </TouchableOpacity>
        </View>
      )}

      {/* Editing Preview Bar */}
      {editingMessage && (
        <View style={styles.previewBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.previewTitle}>Editing Message</Text>
            <Text style={styles.previewContent} numberOfLines={1}>
              {editingMessage.content}
            </Text>
          </View>
          <TouchableOpacity onPress={() => { setEditingMessage(null); setInputText(''); }}>
            <Ionicons name="close" size={18} color="#64748b" />
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.emojiBtn} onPress={toggleEmojiPicker}>
          <Ionicons name="happy-outline" size={24} color="#94a3b8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.emojiBtn} onPress={handleAttachmentPress}>
          <Ionicons name="attach-outline" size={24} color="#94a3b8" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder={editingMessage ? 'Edit message...' : 'Type a message...'}
          placeholderTextColor="#64748b"
          value={inputText}
          onChangeText={handleTextChange}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendBtnText}>{editingMessage ? 'Save' : 'Send'}</Text>
        </TouchableOpacity>
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

            {(selectedActionMessage?.sender?._id === user?._id || ['admin', 'superadmin'].includes(user?.role)) && (
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e1621' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#17212b',
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#101921',
  },
  backText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#f1f5f9', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 14, paddingVertical: 10 },
  bubbleWrapper: { marginBottom: 12, maxWidth: '80%' },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end' },
  senderName: { fontSize: 11, color: '#64748b', marginBottom: 2, marginLeft: 4 },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, position: 'relative' },
  bubbleSelf: {
    backgroundColor: '#2b5278',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#182533',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 16,
  },
  bubbleText: { fontSize: 15 },
  textSelf: { color: '#ffffff' },
  textOther: { color: '#f1f5f9' },
  bubbleTime: { fontSize: 10, opacity: 0.7, alignSelf: 'flex-end' },
  timeSelf: { color: 'rgba(255, 255, 255, 0.7)' },
  timeOther: { color: '#64748b' },
  typingIndicator: { fontSize: 12, fontStyle: 'italic', color: '#64748b', paddingHorizontal: 16, paddingVertical: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#17212b', borderTopWidth: 1, borderTopColor: '#101921' },
  emojiBtn: { padding: 6, marginRight: 8 },
  emojiBtnText: { fontSize: 22, color: '#94a3b8' },
  input: {
    flex: 1,
    backgroundColor: '#182533',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#24303f',
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: '#f1f5f9',
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: { marginLeft: 10, backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  sendBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  emojiPicker: { backgroundColor: '#111827', borderTopWidth: 1, borderTopColor: '#1e293b', padding: 8 },
  emojiCell: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  emojiText: { fontSize: 24 },
  headerSub: { fontSize: 10, color: '#64748b', marginTop: 2, fontWeight: '600' },
  fileText: { fontSize: 15, fontWeight: 'bold', textDecorationLine: 'underline' },
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
    paddingVertical: 8,
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
    paddingVertical: 6,
    color: '#f1f5f9',
    fontSize: 14,
    marginRight: 8,
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
});
