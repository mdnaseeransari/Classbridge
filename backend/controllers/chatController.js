const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

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
    ? 'name role email phone'       // admin sees phone
    : 'name role';                  // teacher/student sees no phone
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

module.exports = { getOrCreateDirect, listConversations, getConversation, getMessages };
