const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// ─── Role helpers (same logic as chatController — kept local to avoid circular deps) ──
const ADMIN_ROLES = ['admin', 'superadmin'];
const MEMBER_ROLES = ['teacher', 'student'];

function isAdmin(role) { return ADMIN_ROLES.includes(role); }
function isMember(role) { return MEMBER_ROLES.includes(role); }
function canDirectChat(roleA, roleB) {
  return (isAdmin(roleA) && isMember(roleB)) || (isMember(roleA) && isAdmin(roleB));
}

/**
 * Safe sender fields for Socket.io message payloads.
 * Phone is included only for admin/superadmin callers.
 */
function safeSenderFields(sender, callerRole) {
  const base = {
    _id: sender._id,
    name: sender.name,
    role: sender.role,
  };
  if (isAdmin(callerRole)) {
    base.phone = sender.phone || null;
    base.email = sender.email || null;
  }
  return base;
}

// ─── In-memory online presence registry ──────────────────────────────────────
// Map<userId (string), Set<socketId (string)>>
// A user is "online" if they have at least one active socket connection.
const onlineUsers = new Map();

function userIsOnline(userId) {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// initChatSocket(io)
// Call this once after creating the Socket.io server instance.
// ─────────────────────────────────────────────────────────────────────────────
function initChatSocket(io) {

  // ── Socket.io JWT auth middleware ──────────────────────────────────────────
  // Runs before the 'connection' event for every socket.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('AUTH_REQUIRED'));

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return next(new Error('INVALID_TOKEN'));
      }

      const user = await User.findById(decoded.id).select(
        '_id name role status isBanned isLocked phone email'
      );

      if (!user) return next(new Error('USER_NOT_FOUND'));
      if (user.isBanned) return next(new Error('BANNED'));
      if (user.isLocked) return next(new Error('LOCKED'));
      if (user.status !== 'approved') return next(new Error('NOT_APPROVED'));

      // Attach full user to socket for use in event handlers
      socket.userId = user._id.toString();
      socket.userRole = user.role;
      socket.userData = user; // used to build safe sender payloads

      return next();
    } catch (err) {
      console.error('[SOCKET] auth middleware error:', err);
      return next(new Error('SERVER_ERROR'));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const userId = socket.userId;
    const userRole = socket.userRole;

    // ── Register online presence ─────────────────────────────────────────────
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // Broadcast to everyone that this user is now online
    socket.broadcast.emit('user_online', { userId });

    // ────────────────────────────────────────────────────────────────────────
    // Event: join_conversation
    // Client joins a Socket.io room for a conversation so they receive messages.
    // Verifies the caller is a participant before admitting them.
    // ────────────────────────────────────────────────────────────────────────
    socket.on('join_conversation', async ({ conversationId }, ack) => {
      try {
        if (!conversationId) return emitError(socket, 'conversationId is required.');

        const conversation = await Conversation.findById(conversationId).select('participants');
        if (!conversation) return emitError(socket, 'Conversation not found.');

        const isParticipant = conversation.participants.some(
          (p) => p.toString() === userId
        );
        if (!isParticipant) return emitError(socket, 'You are not a participant in this conversation.');

        socket.join(conversationId);
        if (typeof ack === 'function') ack({ success: true });
      } catch (err) {
        console.error('[SOCKET] join_conversation error:', err);
        emitError(socket, 'Failed to join conversation.');
      }
    });

    // ────────────────────────────────────────────────────────────────────────
    // Event: leave_conversation
    // Client leaves a conversation room (e.g. navigates away from chat screen).
    // ────────────────────────────────────────────────────────────────────────
    socket.on('leave_conversation', ({ conversationId }) => {
      if (conversationId) socket.leave(conversationId);
    });

    // ────────────────────────────────────────────────────────────────────────
    // Event: send_message
    // Persist a message and broadcast it to all participants in the room.
    //
    // Payload: { conversationId, content }
    // Emits:   'message_received' → to the conversation room
    // ────────────────────────────────────────────────────────────────────────
    socket.on('send_message', async ({ conversationId, content }, ack) => {
      try {
        if (!conversationId || !content || !String(content).trim()) {
          return emitError(socket, 'conversationId and content are required.');
        }

        const trimmedContent = String(content).trim();
        if (trimmedContent.length > 5000) {
          return emitError(socket, 'Message content cannot exceed 5000 characters.');
        }

        // Verify participant + fetch conversation
        const conversation = await Conversation.findById(conversationId).select(
          'participants type'
        );
        if (!conversation) return emitError(socket, 'Conversation not found.');

        const isParticipant = conversation.participants.some(
          (p) => p.toString() === userId
        );
        if (!isParticipant) return emitError(socket, 'You are not a participant in this conversation.');

        // For direct conversations: re-validate the DM permission on every send
        // in case roles changed after the conversation was created.
        if (conversation.type === 'direct') {
          const otherParticipantId = conversation.participants.find(
            (p) => p.toString() !== userId
          );
          const otherUser = await User.findById(otherParticipantId).select('role');
          if (!otherUser || !canDirectChat(userRole, otherUser.role)) {
            return emitError(
              socket,
              'Direct chat is not permitted between these roles.'
            );
          }
        }

        // Persist the message
        const message = await Message.create({
          conversation: conversationId,
          sender: userId,
          content: trimmedContent,
          type: 'text',
        });

        // Update conversation's last activity
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          lastActivityAt: message.createdAt,
        });

        // Build the payload to emit. We need to respect phone privacy for each
        // recipient. Since all socket room members share the same event, we
        // broadcast a version without phone and let admin clients query it via REST.
        // Phone in message TEXT is delivered as-is — only the sender.phone field
        // on the user object is filtered.
        const payload = {
          _id: message._id,
          conversation: conversationId,
          content: message.content,
          type: message.type,
          createdAt: message.createdAt,
          readBy: [],
          sender: {
            _id: socket.userData._id,
            name: socket.userData.name,
            role: socket.userData.role,
            // Phone deliberately omitted from socket broadcasts —
            // admins who need it can fetch via REST /api/admin/users/:id
          },
        };

        // Emit to everyone in the room (including sender)
        io.to(conversationId).emit('message_received', payload);

        if (typeof ack === 'function') ack({ success: true, messageId: message._id });
      } catch (err) {
        console.error('[SOCKET] send_message error:', err);
        emitError(socket, 'Failed to send message.');
      }
    });

    // ────────────────────────────────────────────────────────────────────────
    // Event: mark_read
    // Mark all messages in a conversation that the caller hasn't read yet.
    //
    // Payload: { conversationId }
    // Emits:   'messages_read' → to the conversation room
    // ────────────────────────────────────────────────────────────────────────
    socket.on('mark_read', async ({ conversationId }, ack) => {
      try {
        if (!conversationId) return;

        const conversation = await Conversation.findById(conversationId).select('participants');
        if (!conversation) return;

        const isParticipant = conversation.participants.some(
          (p) => p.toString() === userId
        );
        if (!isParticipant) return;

        const now = new Date();

        // Bulk update: add this user to readBy of all messages they haven't read
        const result = await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: userId },          // don't mark own messages
            'readBy.user': { $ne: userId },   // not already read
            isDeleted: false,
          },
          { $push: { readBy: { user: userId, readAt: now } } }
        );

        if (result.modifiedCount > 0) {
          // Broadcast read receipt to everyone in the room
          io.to(conversationId).emit('messages_read', {
            conversationId,
            readBy: userId,
            readAt: now,
          });
        }

        if (typeof ack === 'function') ack({ success: true });
      } catch (err) {
        console.error('[SOCKET] mark_read error:', err);
      }
    });

    // ────────────────────────────────────────────────────────────────────────
    // Events: typing_start / typing_stop
    // Relay typing indicators to other participants only (not back to sender).
    //
    // Payload: { conversationId }
    // Emits:   'typing' → to other participants in the room
    // ────────────────────────────────────────────────────────────────────────
    socket.on('typing_start', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit('typing', {
        conversationId,
        userId,
        isTyping: true,
      });
    });

    socket.on('typing_stop', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit('typing', {
        conversationId,
        userId,
        isTyping: false,
      });
    });

    // ────────────────────────────────────────────────────────────────────────
    // Event: get_online_status
    // Check whether a list of user IDs are currently online.
    //
    // Payload: { userIds: string[] }
    // Emits:   callback({ statuses: { [userId]: boolean } })
    // ────────────────────────────────────────────────────────────────────────
    socket.on('get_online_status', ({ userIds } = {}, ack) => {
      if (!Array.isArray(userIds) || typeof ack !== 'function') return;
      const statuses = {};
      userIds.forEach((id) => {
        statuses[id] = userIsOnline(id);
      });
      ack({ statuses });
    });

    // ────────────────────────────────────────────────────────────────────────
    // Disconnect
    // ────────────────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        // Only mark offline when ALL sockets for this user are gone
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          socket.broadcast.emit('user_offline', { userId });
        }
      }
    });
  });
}

// ─── Internal helper ──────────────────────────────────────────────────────────
function emitError(socket, message) {
  socket.emit('chat_error', { error: message });
}

module.exports = { initChatSocket, onlineUsers, userIsOnline };
