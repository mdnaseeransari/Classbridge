import React, { useState, useEffect, useRef, useContext } from 'react';
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
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

const EMOJIS = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];

export default function ChatRoomScreen({ route, navigation }) {
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [activeConversations, setActiveConversations] = useState([]);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);

  const typingTimeoutRef = useRef(null);
  const socketRef = useRef(null);

  const isGroup = conversation?.type === 'group';
  const isAdminUser = ['admin', 'superadmin'].includes(user?.role);

  useEffect(() => {
    socketRef.current = getSocket();

    const fetchConvoDetails = async () => {
      try {
        const res = await api.get(`/chat/conversations/${conversationId}`);
        setConversation(res.data.conversation);
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
        setMessages((prev) => {
          const now = new Date(newMsg.createdAt).getTime();
          const isDuplicate = prev.some(
            (m) =>
              String(m.sender?._id) === String(newMsg.sender?._id) &&
              m.content === newMsg.content &&
              Math.abs(new Date(m.createdAt).getTime() - now) < 2000
          );
          if (isDuplicate) {
            // Replace the optimistic message (which has a numeric timestamp _id) with the real server message.
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
      }
    };

    if (socketRef.current) {
      socketRef.current.emit('join_conversation', { conversationId });
      socketRef.current.emit('mark_read', { conversationId });

      socketRef.current.on('message_received', onMessageReceived);
      socketRef.current.on('typing', onTyping);
      socketRef.current.on('message_edited', onMessageEdited);
      socketRef.current.on('message_deleted', onMessageDeleted);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_conversation', { conversationId });
        socketRef.current.off('message_received', onMessageReceived);
        socketRef.current.off('typing', onTyping);
        socketRef.current.off('message_edited', onMessageEdited);
        socketRef.current.off('message_deleted', onMessageDeleted);
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

    const isSelf = item.sender?._id === user?._id;
    const isUserAdmin = ['admin', 'superadmin'].includes(user?.role);
    const options = [];

    // 1. Reply Option
    options.push({
      text: 'Reply 💬',
      onPress: () => {
        setReplyingTo(item);
        setEditingMessage(null);
      },
    });

    // 2. Edit Option (own text messages only)
    if (isSelf && item.type !== 'file') {
      options.push({
        text: 'Edit ✏️',
        onPress: () => {
          setEditingMessage(item);
          setInputText(item.content || '');
          setReplyingTo(null);
        },
      });
    }

    // 3. Delete Option (own messages, or admin/superadmin for any message)
    if (isSelf || isUserAdmin) {
      options.push({
        text: 'Delete 🗑️',
        style: 'destructive',
        onPress: () => confirmDelete(item._id),
      });
    }

    // 4. Forward Option
    options.push({
      text: 'Forward ↪️',
      onPress: () => handleForwardSetup(item),
    });

    // 5. Report Option (others messages only)
    if (!isSelf) {
      options.push({
        text: 'Report ⚠️',
        style: 'destructive',
        onPress: () => reportMessage(item._id),
      });
    }

    options.push({
      text: 'Cancel',
      style: 'cancel',
    });

    Alert.alert('Message Actions', 'Select an action:', options);
  };

  const confirmDelete = (msgId) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Optimistically delete locally
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
            try {
              await api.delete(`/chat/messages/${msgId}`);
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to delete message.');
            }
          },
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
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access camera roll is required.');
        return;
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
      formData.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name,
        type: mimeType,
      });

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

  const reportMessage = (msgId) => {
    Alert.prompt(
      'Report Message',
      'Please state the reason for reporting this message:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          onPress: async (reason) => {
            if (!reason) return;
            try {
              await api.post(`/chat/messages/${msgId}/report`, { reason });
              Alert.alert('Report Submitted', 'Thank you. The administrators will review this message shortly.');
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to submit report.');
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

  const renderBubble = ({ item }) => {
    const isSelf = item.sender?._id === user?._id;
    const formattedTime = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (item.isDeleted) {
      return (
        <View style={[styles.bubbleWrapper, isSelf ? styles.bubbleRight : styles.bubbleLeft]}>
          {isGroup && !isSelf && <Text style={styles.senderName}>{item.sender?.name}</Text>}
          <View style={[styles.bubble, styles.bubbleDeleted]}>
            <Text style={styles.textDeleted}>This message was deleted</Text>
            <Text style={[styles.bubbleTime, { color: '#64748b' }]}>{formattedTime}</Text>
          </View>
        </View>
      );
    }

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => handleLongPress(item)}
        style={[styles.bubbleWrapper, isSelf ? styles.bubbleRight : styles.bubbleLeft]}
      >
        {isGroup && !isSelf && <Text style={styles.senderName}>{item.sender?.name}</Text>}
        <View style={[styles.bubble, isSelf ? styles.bubbleSelf : styles.bubbleOther]}>
          {item.forwardedFrom && (
            <Text style={[styles.forwardedIndicator, isSelf ? styles.timeSelf : styles.timeOther]}>
              ↪️ Forwarded
            </Text>
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
          <View style={styles.bubbleFooter}>
            {item.isEdited && (
              <Text style={[styles.editedLabel, isSelf ? styles.timeSelf : styles.timeOther]}>edited </Text>
            )}
            <Text style={[styles.bubbleTime, isSelf ? styles.timeSelf : styles.timeOther]}>{formattedTime}</Text>
          </View>
        </View>
      </TouchableOpacity>
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleHeaderPress} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          {isGroup && <Text style={styles.headerSub}>Tap for Info ℹ</Text>}
        </TouchableOpacity>
        <View style={{ width: 40 }} />
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
            <Text style={styles.previewClose}>✕</Text>
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
            <Text style={styles.previewClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.emojiBtn} onPress={toggleEmojiPicker}>
          <Text style={styles.emojiBtnText}>☺</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.emojiBtn} onPress={handleAttachmentPress}>
          <Text style={styles.emojiBtnText}>📎</Text>
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
    </KeyboardAvoidingView>
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
  backText: { color: '#38bdf8', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#f8fafc', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 14, paddingVertical: 10 },
  bubbleWrapper: { marginBottom: 12, maxWidth: '80%' },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end' },
  senderName: { fontSize: 11, color: '#64748b', marginBottom: 2, marginLeft: 4 },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, position: 'relative' },
  bubbleSelf: { backgroundColor: '#0284c7', borderBottomRightRadius: 2 },
  bubbleOther: { backgroundColor: '#1e293b', borderBottomLeftRadius: 2 },
  bubbleText: { fontSize: 15 },
  textSelf: { color: '#ffffff' },
  textOther: { color: '#f8fafc' },
  bubbleTime: { fontSize: 9, marginTop: 4, alignSelf: 'flex-end' },
  timeSelf: { color: '#bae6fd' },
  timeOther: { color: '#64748b' },
  typingIndicator: { fontSize: 12, fontStyle: 'italic', color: '#64748b', paddingHorizontal: 16, paddingVertical: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155' },
  emojiBtn: { padding: 6, marginRight: 8 },
  emojiBtnText: { fontSize: 22, color: '#94a3b8' },
  input: { flex: 1, backgroundColor: '#0f172a', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, color: '#f8fafc', fontSize: 15, maxHeight: 100 },
  sendBtn: { marginLeft: 10, backgroundColor: '#38bdf8', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  sendBtnText: { color: '#0f172a', fontWeight: '800', fontSize: 14 },
  emojiPicker: { backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155', padding: 8 },
  emojiCell: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  emojiText: { fontSize: 24 },
  headerSub: { fontSize: 10, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  fileText: { fontSize: 15, fontWeight: 'bold', textDecorationLine: 'underline' },
  uploadingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', paddingVertical: 8, paddingHorizontal: 16, gap: 10, borderTopWidth: 1, borderTopColor: '#334155' },
  uploadingText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 },
  editedLabel: { fontSize: 8, fontStyle: 'italic' },
  bubbleDeleted: { backgroundColor: '#334155', opacity: 0.6, borderBottomRightRadius: 2, borderBottomLeftRadius: 2 },
  textDeleted: { color: '#94a3b8', fontStyle: 'italic', fontSize: 14 },
  forwardedIndicator: { fontSize: 9, fontStyle: 'italic', marginBottom: 4 },
  replyQuoteBox: { backgroundColor: 'rgba(0,0,0,0.15)', borderLeftWidth: 3, borderLeftColor: '#38bdf8', padding: 6, borderRadius: 4, marginBottom: 6 },
  replyQuoteSender: { fontSize: 11, fontWeight: '700', color: '#38bdf8', marginBottom: 2 },
  replyQuoteContent: { fontSize: 12, color: '#94a3b8' },
  previewBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155', paddingHorizontal: 16, paddingVertical: 8 },
  previewTitle: { fontSize: 11, fontWeight: '700', color: '#38bdf8', marginBottom: 2 },
  previewContent: { fontSize: 13, color: '#94a3b8' },
  previewClose: { fontSize: 16, color: '#94a3b8', fontWeight: '700', paddingHorizontal: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#1e293b', borderRadius: 12, width: '85%', padding: 20, borderWidth: 1, borderColor: '#334155' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#f8fafc' },
  closeText: { fontSize: 14, color: '#ef4444', fontWeight: '700' },
  convoItem: { paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convoName: { fontSize: 14, color: '#f8fafc', fontWeight: '600' },
  convoType: { fontSize: 10, color: '#64748b', fontWeight: '700' },
  separator: { height: 1, backgroundColor: '#334155' },
  modalCenter: { paddingVertical: 20, alignItems: 'center' },
});
