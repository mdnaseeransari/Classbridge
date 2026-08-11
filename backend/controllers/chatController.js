const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const GroupInvite = require('../models/GroupInvite');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { sendExpoPushNotifications } = require('../utils/pushNotifications');
const { userIsOnline, getIO } = require('../socket/chatSocket');

// ─── Role helpers ─────────────────────────────────────────────────────────────
const ADMIN_ROLES = ['admin', 'superadmin'];
const MEMBER_ROLES = ['teacher', 'student'];

function isAdmin(role) { return ADMIN_ROLES.includes(role); }
function isMember(role) { return MEMBER_ROLES.includes(role); }

/**
 * Returns true unless BOTH parties are non-admin members (teacher/student).
 * Allowed: admin↔teacher, admin↔student, admin↔admin, admin↔superadmin,
 *          superadmin↔superadmin.
 * Blocked: teacher↔student, teacher↔teacher, student↔student.
 */
function canDirectChat(roleA, roleB) {
  // Direct chat is allowed between every role combination EXCEPT Teacher ↔ Student.
  const isTeacher = roleA === 'teacher' || roleB === 'teacher';
  const isStudent = roleA === 'student' || roleB === 'student';
  return !(isTeacher && isStudent);
}

/**
 * Build a safe sender/participant projection based on who is asking.
 * Admin callers may see phone; teacher/student callers may not.
 */
function senderProjection(callerRole) {
  return isAdmin(callerRole)
    ? 'name role email phone subject classGrade'       // admin sees phone & details
    : 'name role subject classGrade';                  // teacher/student sees no phone or email
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat/direct
// Get or create a 1-to-1 conversation between the caller and a recipient.
// Permission rules enforced here at the API level.
// ─────────────────────────────────────────────────────────────────────────────
async function getOrCreateDirect(req, res) {
  try {
    const { recipientId } = req.body;
    const callerId = req.user.id;
    const callerRole = req.user.role;

    if (!recipientId) {
      return res.status(400).json({ error: 'recipientId is required.' });
    }
    if (recipientId === callerId) {
      return res.status(400).json({ error: 'Cannot create a conversation with yourself.' });
    }

    const recipient = await User.findById(recipientId).select('_id role status isBanned');
    if (!recipient) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (recipient.status !== 'approved' || recipient.isBanned) {
      return res.status(403).json({ error: 'Cannot start a conversation with this user.' });
    }

    // ── Enforce the member↔member block at the API level ─────────────────────
    // Teachers and Students cannot DM each other (or other teachers/students).
    // Admins and Super Admins may DM anyone, including each other.
    if (!canDirectChat(callerRole, recipient.role)) {
      return res.status(403).json({
        error:
          'Direct 1-to-1 chat is not permitted between Teachers and Students. ' +
          'Both Teachers and Students may only send direct messages to an Admin or Super Admin.',
      });
    }

    // ── Find existing conversation or create one ───────────────────────────────
    const pairKey = [callerId, recipientId].sort().join('_');
    let conversation = await Conversation.findOne({ type: 'direct', participantPair: pairKey });

    if (!conversation) {
      conversation = await Conversation.create({
        type: 'direct',
        participants: [callerId, recipientId],
        participantPair: pairKey,
        createdBy: callerId,
      });
    }

    // Populate participants for the response (respect phone privacy)
    await conversation.populate('participants', senderProjection(callerRole));
    await conversation.populate({ path: 'lastMessage', select: 'content type createdAt sender' });

    return res.status(200).json({ conversation });
  } catch (err) {
    console.error('[CHAT] getOrCreateDirect error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/conversations
// List all conversations the caller is a participant in, sorted by activity.
// ─────────────────────────────────────────────────────────────────────────────
async function listConversations(req, res) {
  try {
    const callerId = req.user.id;
    const callerRole = req.user.role;
    const { page = 1, limit = 20, archived = 'false' } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Get user's pinned, archived, and muted arrays
    const userObj = await User.findById(callerId).select('pinnedConversations archivedConversations mutedConversations');
    const pinnedIds = userObj?.pinnedConversations?.map(id => id.toString()) || [];
    const archivedIds = userObj?.archivedConversations?.map(id => id.toString()) || [];
    const mutedIds = userObj?.mutedConversations?.map(id => id.toString()) || [];

    const isArchivedQuery = archived === 'true';
    const query = {
      participants: callerId,
      _id: isArchivedQuery ? { $in: archivedIds } : { $nin: archivedIds }
    };

    // Users can only see conversations they participate in.
    const [conversations, total] = await Promise.all([
      Conversation.find(query)
        .populate('participants', senderProjection(callerRole))
        .populate({ path: 'lastMessage', select: 'content type createdAt sender isDeleted' })
        .lean(),
      Conversation.countDocuments(query),
    ]);

    // Map fields
    const mapped = conversations.map(c => ({
      ...c,
      isPinned: pinnedIds.includes(c._id.toString()),
      isArchived: archivedIds.includes(c._id.toString()),
      isMuted: mutedIds.includes(c._id.toString()),
    }));

    // Sort: Pinned first, then newest lastActivityAt/createdAt first
    mapped.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const timeA = new Date(a.lastActivityAt || a.createdAt);
      const timeB = new Date(b.lastActivityAt || b.createdAt);
      return timeB - timeA;
    });

    const paginatedConversations = mapped.slice(skip, skip + limitNum);

    return res.status(200).json({
      conversations: paginatedConversations,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[CHAT] listConversations error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/conversations/:id
// Get a single conversation. The caller must be a participant.
// ─────────────────────────────────────────────────────────────────────────────
async function getConversation(req, res) {
  try {
    const callerId = req.user.id;
    const callerRole = req.user.role;

    const conversation = await Conversation.findById(req.params.id)
      .populate('participants', senderProjection(callerRole))
      .populate({ path: 'lastMessage', select: 'content type createdAt sender isDeleted' });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    // Participant-only visibility check
    const isParticipant = conversation.participants.some(
      (p) => p._id.toString() === callerId
    );
    if (!isParticipant) {
      return res.status(403).json({ error: 'You are not a participant in this conversation.' });
    }

    const userObj = await User.findById(callerId).select('pinnedConversations archivedConversations mutedConversations');
    const pinnedIds = userObj?.pinnedConversations?.map(id => id.toString()) || [];
    const archivedIds = userObj?.archivedConversations?.map(id => id.toString()) || [];
    const mutedIds = userObj?.mutedConversations?.map(id => id.toString()) || [];

    const convoObj = conversation.toObject();
    convoObj.isPinned = pinnedIds.includes(conversation._id.toString());
    convoObj.isArchived = archivedIds.includes(conversation._id.toString());
    convoObj.isMuted = mutedIds.includes(conversation._id.toString());

    return res.status(200).json({ conversation: convoObj });
  } catch (err) {
    console.error('[CHAT] getConversation error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chat/conversations/:id/messages
// Paginated message history. 50 messages per page, oldest-first within page.
// Caller must be a participant.
// ─────────────────────────────────────────────────────────────────────────────
async function getMessages(req, res) {
  try {
    const callerId = req.user.id;
    const callerRole = req.user.role;
    const { page = 1 } = req.query;
    const PAGE_SIZE = 50;

    const conversation = await Conversation.findById(req.params.id).select('participants');
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === callerId
    );
    if (!isParticipant) {
      return res.status(403).json({ error: 'You are not a participant in this conversation.' });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const skip = (pageNum - 1) * PAGE_SIZE;

    // Fetch newest pages first (desc), then reverse for chronological display
    const [rawMessages, total] = await Promise.all([
      Message.find({ conversation: req.params.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .populate('sender', senderProjection(callerRole))
        .populate({
          path: 'replyTo',
          select: '_id content sender type fileName fileUrl',
          populate: {
            path: 'sender',
            select: senderProjection(callerRole),
          },
        })
        .lean(),
      Message.countDocuments({ conversation: req.params.id }),
    ]);

    // Reverse so the page is oldest-first (natural chat display order)
    const messages = rawMessages.reverse();

    // Mask deleted message content
    const sanitized = messages.map((m) => {
      if (m.isDeleted) {
        return { ...m, content: null, fileUrl: null, fileName: null, fileMimeType: null };
      }
      return m;
    });

    return res.status(200).json({
      messages: sanitized,
      pagination: {
        total,
        page: pageNum,
        limit: PAGE_SIZE,
        totalPages: Math.ceil(total / PAGE_SIZE),
        hasOlderMessages: pageNum < Math.ceil(total / PAGE_SIZE),
      },
    });
  } catch (err) {
    console.error('[CHAT] getMessages error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP CHAT ENDPOINTS (Admin / Super Admin Only for management)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/chat/groups
 * Create a new group chat. ONLY Admin or Super Admin can create groups.
 * Groups can contain a mix of Teachers and Students.
 */
async function createGroup(req, res) {
  try {
    const callerId = req.user.id;
    const callerRole = req.user.role;

    if (!isAdmin(callerRole)) {
      return res.status(403).json({ error: 'Only Admins and Super Admins can create group chats.' });
    }

    const { name, participantIds = [] } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Group name is required.' });
    }

    // Combine creator with unique provided participant IDs
    const memberSet = new Set([callerId, ...participantIds]);
    const memberArray = Array.from(memberSet);

    // Validate that all added members exist and are approved
    const validUsers = await User.find({
      _id: { $in: memberArray },
      status: 'approved',
      isBanned: false,
    }).select('_id');

    const validUserIds = validUsers.map((u) => u._id.toString());

    const conversation = await Conversation.create({
      type: 'group',
      name: String(name).trim(),
      groupAdmin: callerId,
      participants: validUserIds,
      createdBy: callerId,
    });

    await conversation.populate('participants', senderProjection(callerRole));

    // ── Push Notification Trigger for Added Members ─────────────────────
    (async () => {
      try {
        const addedMemberIds = validUserIds.filter((id) => id !== callerId);
        if (addedMemberIds.length > 0) {
          const targetUsers = await User.find({
            _id: { $in: addedMemberIds },
            expoPushToken: { $ne: null },
          }).select('expoPushToken');

          const senderName = req.user.name || 'Admin';
          const pushPayloads = targetUsers.map((u) => ({
            to: u.expoPushToken,
            title: senderName,
            body: `Added you to group "${conversation.name}"`,
            data: { conversationId: conversation._id, type: 'group_added' },
          }));

          await sendExpoPushNotifications(pushPayloads);
        }
      } catch (pushErr) {
        console.error('[CHAT] createGroup push notification error:', pushErr);
      }
    })();

    return res.status(201).json({ conversation });
  } catch (err) {
    console.error('[CHAT] createGroup error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * PATCH /api/chat/groups/:id
 * Rename a group chat. ONLY Admin or Super Admin can rename groups.
 */
async function updateGroup(req, res) {
  try {
    const callerRole = req.user.role;
    if (!isAdmin(callerRole)) {
      return res.status(403).json({ error: 'Only Admins and Super Admins can update group chats.' });
    }

    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Group name is required.' });
    }

    const conversation = await Conversation.findOne({ _id: req.params.id, type: 'group' });
    if (!conversation) {
      return res.status(404).json({ error: 'Group conversation not found.' });
    }

    conversation.name = String(name).trim();
    await conversation.save();

    await conversation.populate('participants', senderProjection(callerRole));

    return res.status(200).json({ conversation });
  } catch (err) {
    console.error('[CHAT] updateGroup error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * DELETE /api/chat/groups/:id
 * Delete a group chat. ONLY Admin or Super Admin can delete groups.
 */
async function deleteGroup(req, res) {
  try {
    const callerRole = req.user.role;
    if (!isAdmin(callerRole)) {
      return res.status(403).json({ error: 'Only Admins and Super Admins can delete group chats.' });
    }

    const conversation = await Conversation.findOneAndDelete({ _id: req.params.id, type: 'group' });
    if (!conversation) {
      return res.status(404).json({ error: 'Group conversation not found.' });
    }

    // Clean up associated messages
    await Message.deleteMany({ conversation: req.params.id });
    // Revoke any active invites
    await GroupInvite.updateMany({ conversation: req.params.id }, { isActive: false });

    return res.status(200).json({ message: 'Group deleted successfully.' });
  } catch (err) {
    console.error('[CHAT] deleteGroup error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * POST /api/chat/groups/:id/members
 * Add members to a group chat. ONLY Admin or Super Admin can add members.
 */
async function addGroupMembers(req, res) {
  try {
    const callerRole = req.user.role;
    if (!isAdmin(callerRole)) {
      return res.status(403).json({ error: 'Only Admins and Super Admins can add members to a group.' });
    }

    const { userIds = [] } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds array is required.' });
    }

    const conversation = await Conversation.findOne({ _id: req.params.id, type: 'group' });
    if (!conversation) {
      return res.status(404).json({ error: 'Group conversation not found.' });
    }

    // Filter valid approved, non-banned users
    const validUsers = await User.find({
      _id: { $in: userIds },
      status: 'approved',
      isBanned: false,
    }).select('_id');

    const existingSet = new Set(conversation.participants.map((p) => p.toString()));
    const newlyAddedIds = validUsers
      .map((u) => u._id.toString())
      .filter((id) => !existingSet.has(id));

    validUsers.forEach((u) => existingSet.add(u._id.toString()));

    conversation.participants = Array.from(existingSet);
    await conversation.save();

    await conversation.populate('participants', senderProjection(callerRole));

    // ── Push Notification Trigger for Newly Added Members ───────────────
    (async () => {
      try {
        if (newlyAddedIds.length > 0) {
          const targetUsers = await User.find({
            _id: { $in: newlyAddedIds },
            expoPushToken: { $ne: null },
          }).select('expoPushToken');

          const senderName = req.user.name || 'Admin';
          const pushPayloads = targetUsers.map((u) => ({
            to: u.expoPushToken,
            title: senderName,
            body: `Added you to group "${conversation.name}"`,
            data: { conversationId: conversation._id, type: 'group_added' },
          }));

          await sendExpoPushNotifications(pushPayloads);
        }
      } catch (pushErr) {
        console.error('[CHAT] addGroupMembers push notification error:', pushErr);
      }
    })();

    return res.status(200).json({ conversation });
  } catch (err) {
    console.error('[CHAT] addGroupMembers error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * DELETE /api/chat/groups/:id/members/:userId
 * Remove a member from a group. ONLY Admin or Super Admin can remove members.
 */
async function removeGroupMember(req, res) {
  try {
    const callerRole = req.user.role;
    if (!isAdmin(callerRole)) {
      return res.status(403).json({ error: 'Only Admins and Super Admins can remove group members.' });
    }

    const conversation = await Conversation.findOne({ _id: req.params.id, type: 'group' });
    if (!conversation) {
      return res.status(404).json({ error: 'Group conversation not found.' });
    }

    const { userId } = req.params;
    conversation.participants = conversation.participants.filter(
      (p) => p.toString() !== userId
    );
    await conversation.save();

    await conversation.populate('participants', senderProjection(callerRole));

    return res.status(200).json({ conversation });
  } catch (err) {
    console.error('[CHAT] removeGroupMember error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * GET /api/chat/groups/:id/members
 * Fetch full list of members in a group.
 * Phone numbers are ONLY included if caller is Admin or Super Admin.
 */
async function getGroupMembers(req, res) {
  try {
    const callerId = req.user.id;
    const callerRole = req.user.role;

    const conversation = await Conversation.findOne({ _id: req.params.id, type: 'group' })
      .populate('participants', senderProjection(callerRole));

    if (!conversation) {
      return res.status(404).json({ error: 'Group conversation not found.' });
    }

    const isParticipant = conversation.participants.some(
      (p) => p._id.toString() === callerId
    );
    if (!isParticipant && !isAdmin(callerRole)) {
      return res.status(403).json({ error: 'You are not a member of this group.' });
    }

    return res.status(200).json({ members: conversation.participants });
  } catch (err) {
    console.error('[CHAT] getGroupMembers error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * POST /api/chat/groups/:id/invites
 * Generate a shareable invite link for a group. ONLY Admin or Super Admin.
 * Body: { expiresHours, maxUses }
 */
async function createInviteLink(req, res) {
  try {
    const callerId = req.user.id;
    const callerRole = req.user.role;

    if (!isAdmin(callerRole)) {
      return res.status(403).json({ error: 'Only Admins and Super Admins can generate invite links.' });
    }

    const conversation = await Conversation.findOne({ _id: req.params.id, type: 'group' });
    if (!conversation) {
      return res.status(404).json({ error: 'Group conversation not found.' });
    }

    const { expiresHours, maxUses } = req.body;

    let expiresAt = null;
    if (expiresHours && Number(expiresHours) > 0) {
      expiresAt = new Date(Date.now() + Number(expiresHours) * 60 * 60 * 1000);
    }

    let parsedMaxUses = null;
    if (maxUses && Number(maxUses) > 0) {
      parsedMaxUses = parseInt(maxUses, 10);
    }

    const invite = await GroupInvite.create({
      conversation: req.params.id,
      createdBy: callerId,
      expiresAt,
      maxUses: parsedMaxUses,
    });

    return res.status(201).json({
      invite: {
        code: invite.code,
        expiresAt: invite.expiresAt,
        maxUses: invite.maxUses,
        usesCount: invite.usesCount,
        createdAt: invite.createdAt,
      },
    });
  } catch (err) {
    console.error('[CHAT] createInviteLink error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * POST /api/chat/groups/join/:code
 * Join a group using an invite code.
 * Rejects if user is not approved, or is banned, or is locked.
 */
async function joinViaInvite(req, res) {
  try {
    const user = req.user;

    // Explicit security check: user MUST be approved, NOT banned, NOT locked
    if (user.status !== 'approved') {
      return res.status(403).json({ error: 'Your account status must be approved to join groups.' });
    }
    if (user.isBanned) {
      return res.status(403).json({ error: 'Banned accounts cannot join groups.' });
    }
    if (user.isLocked) {
      return res.status(403).json({ error: 'Locked accounts cannot join groups until unlocked by an Admin.' });
    }

    const { code } = req.params;
    const invite = await GroupInvite.findOne({ code, isActive: true });
    if (!invite) {
      return res.status(404).json({ error: 'Invalid or inactive invite link.' });
    }

    // Check expiry
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return res.status(410).json({ error: 'This invite link has expired.' });
    }

    // Check max uses
    if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) {
      return res.status(410).json({ error: 'This invite link has reached its maximum number of uses.' });
    }

    const conversation = await Conversation.findOne({ _id: invite.conversation, type: 'group' });
    if (!conversation) {
      return res.status(404).json({ error: 'Group conversation no longer exists.' });
    }

    // Add user to participants if not already present
    const userIdStr = user.id.toString();
    const isAlreadyMember = conversation.participants.some((p) => p.toString() === userIdStr);

    if (!isAlreadyMember) {
      conversation.participants.push(user.id);
      await conversation.save();

      // Track usage
      invite.usesCount += 1;
      invite.usedBy.push({ user: user.id, usedAt: new Date() });
      await invite.save();
    }

    await conversation.populate('participants', senderProjection(user.role));

    return res.status(200).json({
      message: isAlreadyMember ? 'You are already a member of this group.' : 'Successfully joined group.',
      conversation,
    });
  } catch (err) {
    console.error('[CHAT] joinViaInvite error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * POST /api/chat/conversations/:id/attachment
 * Upload a file attachment (image, PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX up to 10 MB)
 * to Cloudinary and store as a file message.
 */
async function sendFileAttachment(req, res) {
  try {
    const callerId = req.user.id;
    const callerRole = req.user.role;
    const conversationId = req.params.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided.' });
    }

    const conversation = await Conversation.findById(conversationId).select('participants type');
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === callerId
    );
    if (!isParticipant) {
      return res.status(403).json({ error: 'You are not a participant in this conversation.' });
    }

    // For direct conversations: re-validate DM role rules
    if (conversation.type === 'direct') {
      const otherParticipantId = conversation.participants.find(
        (p) => p.toString() !== callerId
      );
      const otherUser = await User.findById(otherParticipantId).select('role status isBanned');
      if (!otherUser || !canDirectChat(callerRole, otherUser.role)) {
        return res.status(403).json({ error: 'Direct chat is not permitted between these roles.' });
      }
    }

    // Upload memory buffer to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);

    const caption = req.body.caption ? String(req.body.caption).trim() : null;

    const message = await Message.create({
      conversation: conversationId,
      sender: callerId,
      content: caption || req.file.originalname,
      type: 'file',
      fileUrl: cloudinaryResult.secure_url,
      fileName: req.file.originalname,
      fileMimeType: req.file.mimetype,
      fileSizeBytes: req.file.size,
    });

    // Update conversation last activity
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      lastActivityAt: message.createdAt,
    });

    await message.populate('sender', senderProjection(callerRole));

    // ── Push Notification Trigger for Offline Participants ───────────────
    (async () => {
      try {
        const offlineRecipientIds = conversation.participants.filter(
          (pId) => pId.toString() !== callerId && !userIsOnline(pId.toString())
        );

        if (offlineRecipientIds.length > 0) {
          const offlineUsers = await User.find({
            _id: { $in: offlineRecipientIds },
            expoPushToken: { $ne: null },
          }).select('expoPushToken');

          const senderName = req.user.name || 'Someone';
          const pushPayloads = offlineUsers.map((u) => ({
            to: u.expoPushToken,
            title: senderName,
            body: `Sent an attachment: ${req.file.originalname}`,
            data: { conversationId: conversation._id, type: 'new_message' },
          }));

          await sendExpoPushNotifications(pushPayloads);
        }
      } catch (pushErr) {
        console.error('[CHAT] sendFileAttachment push notification error:', pushErr);
      }
    })();

    // Emit message_received socket event to the room
    const io = getIO();
    if (io) {
      const payload = {
        _id: message._id,
        conversation: conversationId,
        content: message.content,
        type: message.type,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileMimeType: message.fileMimeType,
        fileSizeBytes: message.fileSizeBytes,
        createdAt: message.createdAt,
        readBy: [],
        sender: {
          _id: message.sender._id,
          name: message.sender.name,
          role: message.sender.role,
        },
      };
      io.to(conversationId).emit('message_received', payload);
    }

    return res.status(201).json({ message });
  } catch (err) {
    console.error('[CHAT] sendFileAttachment error:', err);
    return res.status(500).json({ error: 'Failed to upload attachment.' });
  }
}

/**
 * POST /api/chat/messages/:id/report
 * Report a message for review by admins.
 * Requires caller to be a participant in the message's conversation.
 * Marks Message.isReported = true (exempts from cron cleanup).
 */
async function reportMessage(req, res) {
  try {
    const callerId = req.user.id;
    const { id: messageId } = req.params;
    const { reason, details } = req.body;

    const validReasons = ['inappropriate_content', 'harassment', 'contact_exchange', 'spam', 'other'];
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({
        error: `reason is required and must be one of: ${validReasons.join(', ')}.`,
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    const conversation = await Conversation.findById(message.conversation).select('participants');
    if (!conversation) {
      return res.status(404).json({ error: 'Associated conversation not found.' });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === callerId
    );
    if (!isParticipant) {
      return res.status(403).json({ error: 'You are not a participant in this conversation.' });
    }

    // Check if caller already reported this message
    const MessageReport = require('../models/MessageReport');
    const existingReport = await MessageReport.findOne({ message: messageId, reporter: callerId });
    if (existingReport) {
      return res.status(409).json({ error: 'You have already reported this message.' });
    }

    const report = await MessageReport.create({
      message: messageId,
      conversation: message.conversation,
      reporter: callerId,
      reportedUser: message.sender,
      reason,
      details: details ? String(details).trim() : null,
    });

    // Mark message as reported so it is exempt from auto-cleanup cron
    if (!message.isReported) {
      message.isReported = true;
      await message.save();
    }

    return res.status(201).json({
      message: 'Report submitted successfully.',
      report,
    });
  } catch (err) {
    console.error('[CHAT] reportMessage error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function listAdmins(req, res) {
  try {
    const admins = await User.find(
      { role: { $in: ['admin', 'superadmin'] }, status: 'approved', isBanned: false },
      'name role email subject classGrade'
    ).sort({ name: 1 });
    return res.status(200).json({ users: admins });
  } catch (err) {
    console.error('[CHAT] listAdmins error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function listContacts(req, res) {
  try {
    const callerId = req.user.id;
    const callerRole = req.user.role;

    let query = { status: 'approved', isBanned: false, _id: { $ne: callerId } };

    if (callerRole === 'teacher') {
      // Teachers can only DM Admins/Super Admins and other Teachers
      query.role = { $in: ['admin', 'superadmin', 'teacher'] };
    } else if (callerRole === 'student') {
      // Students can only DM Admins/Super Admins and other Students
      query.role = { $in: ['admin', 'superadmin', 'student'] };
    }

    const contacts = await User.find(query, senderProjection(callerRole)).sort({ name: 1 });
    return res.status(200).json({ users: contacts });
  } catch (err) {
    console.error('[CHAT] listContacts error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function editMessage(req, res) {
  try {
    const callerId = req.user.id;
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    if (message.isDeleted) {
      return res.status(400).json({ error: 'Cannot edit a deleted message.' });
    }

    if (message.sender.toString() !== callerId) {
      return res.status(403).json({ error: 'You can only edit your own messages.' });
    }

    message.content = String(content).trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    // Socket broadcast
    const io = getIO();
    if (io) {
      io.to(message.conversation.toString()).emit('message_edited', {
        _id: message._id,
        conversation: message.conversation,
        content: message.content,
        isEdited: message.isEdited,
        editedAt: message.editedAt,
      });
    }

    return res.status(200).json({ message });
  } catch (err) {
    console.error('[CHAT] editMessage error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function deleteMessage(req, res) {
  try {
    const callerId = req.user.id;
    const callerRole = req.user.role;
    const { id } = req.params;

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    if (message.isDeleted) {
      return res.status(400).json({ error: 'Message is already deleted.' });
    }

    const isOwner = message.sender.toString() === callerId;
    const isUserAdmin = ['admin', 'superadmin'].includes(callerRole);

    if (!isOwner && !isUserAdmin) {
      return res.status(403).json({ error: 'You are not authorized to delete this message.' });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.content = null;
    message.fileUrl = null;
    message.fileName = null;
    message.fileMimeType = null;
    message.fileSizeBytes = null;
    await message.save();

    // Socket broadcast
    const io = getIO();
    if (io) {
      io.to(message.conversation.toString()).emit('message_deleted', {
        _id: message._id,
        conversation: message.conversation,
      });
    }

    return res.status(200).json({ message: 'Message deleted successfully.' });
  } catch (err) {
    console.error('[CHAT] deleteMessage error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function forwardMessage(req, res) {
  try {
    const callerId = req.user.id;
    const callerRole = req.user.role;
    const { id } = req.params;
    const { conversationId: targetConversationId } = req.body;

    if (!targetConversationId) {
      return res.status(400).json({ error: 'conversationId is required to forward.' });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ error: 'Original message not found.' });
    }

    if (message.isDeleted) {
      return res.status(400).json({ error: 'Cannot forward a deleted message.' });
    }

    // Verify participant in source conversation
    const sourceConvo = await Conversation.findById(message.conversation).select('participants');
    if (!sourceConvo || !sourceConvo.participants.some(p => p.toString() === callerId)) {
      return res.status(403).json({ error: 'You do not have permission to forward this message.' });
    }

    // Verify participant in target conversation
    const targetConvo = await Conversation.findById(targetConversationId).select('participants type');
    if (!targetConvo) {
      return res.status(404).json({ error: 'Target conversation not found.' });
    }

    if (!targetConvo.participants.some(p => p.toString() === callerId)) {
      return res.status(403).json({ error: 'You are not a participant in the target conversation.' });
    }

    // Direct chat validation for target
    if (targetConvo.type === 'direct') {
      const otherParticipantId = targetConvo.participants.find(p => p.toString() !== callerId);
      const otherUser = await User.findById(otherParticipantId).select('role');
      if (!otherUser || !canDirectChat(callerRole, otherUser.role)) {
        return res.status(403).json({ error: 'Direct chat is not permitted between these roles in the target conversation.' });
      }
    }

    const newMessage = await Message.create({
      conversation: targetConversationId,
      sender: callerId,
      content: message.content,
      type: message.type,
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      fileMimeType: message.fileMimeType,
      fileSizeBytes: message.fileSizeBytes,
      forwardedFrom: true,
    });

    await Conversation.findByIdAndUpdate(targetConversationId, {
      lastMessage: newMessage._id,
      lastActivityAt: newMessage.createdAt,
    });

    await newMessage.populate('sender', senderProjection(callerRole));

    // Socket broadcast to target conversation
    const io = getIO();
    if (io) {
      const payload = {
        _id: newMessage._id,
        conversation: targetConversationId,
        content: newMessage.content,
        type: newMessage.type,
        fileUrl: newMessage.fileUrl,
        fileName: newMessage.fileName,
        fileMimeType: newMessage.fileMimeType,
        fileSizeBytes: newMessage.fileSizeBytes,
        forwardedFrom: newMessage.forwardedFrom,
        createdAt: newMessage.createdAt,
        readBy: [],
        sender: {
          _id: newMessage.sender._id,
          name: newMessage.sender.name,
          role: newMessage.sender.role,
        },
      };
      io.to(targetConversationId).emit('message_received', payload);
    }

    return res.status(201).json({ message: newMessage });
  } catch (err) {
    console.error('[CHAT] forwardMessage error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function pinConversation(req, res) {
  try {
    const callerId = req.user.id;
    const { id } = req.params;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    if (!conversation.participants.some(p => p.toString() === callerId)) {
      return res.status(403).json({ error: 'You are not a participant in this conversation.' });
    }

    await User.findByIdAndUpdate(callerId, {
      $addToSet: { pinnedConversations: id },
    });

    return res.status(200).json({ success: true, message: 'Conversation pinned.' });
  } catch (err) {
    console.error('[CHAT] pinConversation error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function unpinConversation(req, res) {
  try {
    const callerId = req.user.id;
    const { id } = req.params;

    await User.findByIdAndUpdate(callerId, {
      $pull: { pinnedConversations: id },
    });

    return res.status(200).json({ success: true, message: 'Conversation unpinned.' });
  } catch (err) {
    console.error('[CHAT] unpinConversation error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function archiveConversation(req, res) {
  try {
    const callerId = req.user.id;
    const { id } = req.params;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    if (!conversation.participants.some(p => p.toString() === callerId)) {
      return res.status(403).json({ error: 'You are not a participant.' });
    }

    await User.findByIdAndUpdate(callerId, {
      $addToSet: { archivedConversations: id },
    });

    return res.status(200).json({ success: true, message: 'Conversation archived.' });
  } catch (err) {
    console.error('[CHAT] archiveConversation error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function unarchiveConversation(req, res) {
  try {
    const callerId = req.user.id;
    const { id } = req.params;

    await User.findByIdAndUpdate(callerId, {
      $pull: { archivedConversations: id },
    });

    return res.status(200).json({ success: true, message: 'Conversation unarchived.' });
  } catch (err) {
    console.error('[CHAT] unarchiveConversation error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function muteConversation(req, res) {
  try {
    const callerId = req.user.id;
    const { id } = req.params;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    if (!conversation.participants.some(p => p.toString() === callerId)) {
      return res.status(403).json({ error: 'You are not a participant.' });
    }

    await User.findByIdAndUpdate(callerId, {
      $addToSet: { mutedConversations: id },
    });

    return res.status(200).json({ success: true, message: 'Conversation muted.' });
  } catch (err) {
    console.error('[CHAT] muteConversation error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function unmuteConversation(req, res) {
  try {
    const callerId = req.user.id;
    const { id } = req.params;

    await User.findByIdAndUpdate(callerId, {
      $pull: { mutedConversations: id },
    });

    return res.status(200).json({ success: true, message: 'Conversation unmuted.' });
  } catch (err) {
    console.error('[CHAT] unmuteConversation error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

async function searchMessages(req, res) {
  try {
    const callerId = req.user.id;
    const { id } = req.params;
    const { q } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Search query is required.' });
    }

    const conversation = await Conversation.findById(id).select('participants');
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const isParticipant = conversation.participants.some(p => p.toString() === callerId);
    if (!isParticipant) {
      return res.status(403).json({ error: 'You are not a participant in this conversation.' });
    }

    const queryRegex = new RegExp(q.trim(), 'i');
    const messages = await Message.find({
      conversation: id,
      content: queryRegex,
      isDeleted: false
    })
      .populate('sender', 'name role')
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({ messages });
  } catch (err) {
    console.error('[CHAT] searchMessages error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = {
  getOrCreateDirect,
  listConversations,
  getConversation,
  getMessages,
  createGroup,
  updateGroup,
  deleteGroup,
  addGroupMembers,
  removeGroupMember,
  getGroupMembers,
  createInviteLink,
  joinViaInvite,
  sendFileAttachment,
  reportMessage,
  listAdmins,
  listContacts,
  editMessage,
  deleteMessage,
  forwardMessage,
  pinConversation,
  unpinConversation,
  archiveConversation,
  unarchiveConversation,
  muteConversation,
  unmuteConversation,
  searchMessages,
};

