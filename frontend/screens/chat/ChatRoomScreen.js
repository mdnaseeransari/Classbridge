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
} from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import api from '../../services/api';
import { getSocket } from '../../services/socket';

const EMOJIS = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'];

export default function ChatRoomScreen({ route, navigation }) {
  const { conversationId, title } = route.params;
  const { user } = useContext(AuthContext);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const typingTimeoutRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = getSocket();

    // Fetch initial page of messages (REST API returns oldest-first, so we invert or display appropriately)
    const fetchMessages = async () => {
      try {
        const res = await api.get(`/chat/conversations/${conversationId}/messages`, { params: { page: 1 } });
        // The messages are received oldest-first from backend.
        // We will store them in messages state. We invert FlatList so index 0 is the newest message (bottom).
        // So we reverse the API output array to have the newest messages at index 0.
        const fetched = res.data.messages || [];
        setMessages([...fetched].reverse());
        setHasMore(fetched.length === 50); // limit per page is 50
      } catch (err) {
        console.error('[CHAT_ROOM] Error loading messages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Socket Room Listeners
    if (socketRef.current) {
      // Join conversation room
      socketRef.current.emit('join_conversation', { conversationId });

      // Mark messages read on entry
      socketRef.current.emit('mark_read', { conversationId });

      // Receive real-time message
      socketRef.current.on('message_received', (newMsg) => {
        if (newMsg.conversation === conversationId) {
          setMessages((prev) => [newMsg, ...prev]);

          // Emit mark_read for newly received message if user is active in the room
          socketRef.current.emit('mark_read', { conversationId });
        }
      });

      // Typing status relay
      socketRef.current.on('typing', ({ conversationId: cId, userId, isTyping: typingStatus }) => {
        if (cId === conversationId && userId !== user?._id) {
          setIsTyping(typingStatus);
        }
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_conversation', { conversationId });
        socketRef.current.off('message_received');
        socketRef.current.off('typing');
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

  const handleSend = () => {
    if (!inputText.trim()) return;

    if (socketRef.current) {
      socketRef.current.emit('send_message', {
        conversationId,
        content: inputText.trim(),
      });
    }

    setInputText('');
    handleTypingStop();
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

    // Typing debouncer
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

  const renderBubble = ({ item }) => {
    const isSelf = item.sender?._id === user?._id;
    const formattedTime = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => !isSelf && reportMessage(item._id)}
        style={[styles.bubbleWrapper, isSelf ? styles.bubbleRight : styles.bubbleLeft]}
      >
        {!isSelf && <Text style={styles.senderName}>{item.sender?.name}</Text>}
        <View style={[styles.bubble, isSelf ? styles.bubbleSelf : styles.bubbleOther]}>
          <Text style={[styles.bubbleText, isSelf ? styles.textSelf : styles.textOther]}>{item.content}</Text>
          <Text style={[styles.bubbleTime, isSelf ? styles.timeSelf : styles.timeOther]}>{formattedTime}</Text>
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
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
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

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.emojiBtn} onPress={toggleEmojiPicker}>
          <Text style={styles.emojiBtnText}>☺</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#64748b"
          value={inputText}
          onChangeText={handleTextChange}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendBtnText}>Send</Text>
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
});
