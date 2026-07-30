const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  getOrCreateDirect,
  listConversations,
  getConversation,
  getMessages,
} = require('../controllers/chatController');

const router = express.Router();

// All chat REST routes require authentication
router.use(authenticate);

// ─── Direct Conversation ──────────────────────────────────────────────────────

/**
 * @route   POST /api/chat/direct
 * @desc    Get or create a 1-to-1 conversation with another user.
 *          Teacher↔Student and Admin↔Admin are rejected at the API level.
 * @body    { recipientId }
 * @access  Any approved user (role-specific permission enforced inside controller)
 */
router.post('/direct', getOrCreateDirect);

// ─── Conversations ────────────────────────────────────────────────────────────

/**
 * @route   GET /api/chat/conversations
 * @desc    List all conversations the authenticated user participates in.
 *          An Admin only sees their own DMs — not other admins' DMs.
 * @query   page, limit
 * @access  Any approved user
 */
router.get('/conversations', listConversations);

/**
 * @route   GET /api/chat/conversations/:id
 * @desc    Get a single conversation. Returns 403 if caller is not a participant.
 * @access  Any approved user (participant only)
 */
router.get('/conversations/:id', getConversation);

// ─── Messages ─────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/chat/conversations/:id/messages
 * @desc    Paginated message history for a conversation (50 per page, oldest-first).
 *          Returns 403 if caller is not a participant.
 *          Phone numbers in message content are delivered verbatim.
 * @query   page
 * @access  Any approved user (participant only)
 */
router.get('/conversations/:id/messages', getMessages);

module.exports = router;
