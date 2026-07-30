const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const GroupInvite = require('../models/GroupInvite');

// ─── Role helpers ─────────────────────────────────────────────────────────────
const ADMIN_ROLES = ['admin', 'superadmin'];
const MEMBER_ROLES = ['teacher', 'student'];

function isAdmin(role) { return ADMIN_ROLES.includes(role); }
function isMember(role) { return MEMBER_ROLES.includes(role); }

/**
 * Returns true only if one party is an admin/superadmin and the other is a
 * teacher/student. Blocks teacher↔student and admin↔admin.
 */
function canDirectChat(roleA, roleB) {
  return (isAdmin(roleA) && isMember(roleB)) || (isMember(roleA) && isAdmin(roleB));
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

    // ── Enforce the Teacher↔Student block at the API level ────────────────────
    if (!canDirectChat(callerRole, recipient.role)) {
      return res.status(403).json({
        error:
          'Direct 1-to-1 chat is only permitted between an Admin/Super Admin and a ' +
          'Teacher or Student. Teacher-to-Student and Admin-to-Admin direct chat ' +
          'is not allowed.',
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
    const { page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Users can only see conversations they participate in.
    // This also enforces the visibility rule: admin A cannot see admin B's DMs
    // because admin B's DMs don't list admin A in their participants array.
    const [conversations, total] = await Promise.all([
      Conversation.find({ participants: callerId })
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('participants', senderProjection(callerRole))
        .populate({ path: 'lastMessage', select: 'content type createdAt sender isDeleted' })
        .lean(),
      Conversation.countDocuments({ participants: callerId }),
    ]);

    return res.status(200).json({
      conversations,
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

    return res.status(200).json({ conversation });
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
    validUsers.forEach((u) => existingSet.add(u._id.toString()));

    conversation.participants = Array.from(existingSet);
    await conversation.save();

    await conversation.populate('participants', senderProjection(callerRole));

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
};
