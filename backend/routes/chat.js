const express = require('express');
const { authenticate } = require('../middleware/auth');
const { uploadAttachment } = require('../middleware/upload');
const {
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

// ─── Group Management (Admin / Super Admin ONLY) ──────────────────────────────

/**
 * @route   POST /api/chat/groups
 * @desc    Create a new group chat (mixed Teachers and Students).
 * @access  Admin / Super Admin only
 */
router.post('/groups', createGroup);

/**
 * @route   PATCH /api/chat/groups/:id
 * @desc    Rename a group chat.
 * @access  Admin / Super Admin only
 */
router.patch('/groups/:id', updateGroup);

/**
 * @route   DELETE /api/chat/groups/:id
 * @desc    Delete a group chat.
 * @access  Admin / Super Admin only
 */
router.delete('/groups/:id', deleteGroup);

/**
 * @route   POST /api/chat/groups/:id/members
 * @desc    Add members to a group chat.
 * @access  Admin / Super Admin only
 */
router.post('/groups/:id/members', addGroupMembers);

/**
 * @route   DELETE /api/chat/groups/:id/members/:userId
 * @desc    Remove a member from a group chat.
 * @access  Admin / Super Admin only
 */
router.delete('/groups/:id/members/:userId', removeGroupMember);

/**
 * @route   GET /api/chat/groups/:id/members
 * @desc    Get member list for a group. Omits phone numbers for non-admin callers.
 * @access  Group participant or Admin / Super Admin
 */
router.get('/groups/:id/members', getGroupMembers);

// ─── Group Invite Links ───────────────────────────────────────────────────────

/**
 * @route   POST /api/chat/groups/:id/invites
 * @desc    Generate a shareable invite link with optional expiry/max-uses.
 * @access  Admin / Super Admin only
 */
router.post('/groups/:id/invites', createInviteLink);

/**
 * @route   POST /api/chat/groups/join/:code
 * @desc    Redeem an invite code to join a group. Account must be approved & non-banned.
 * @access  Any approved, non-banned authenticated user
 */
router.post('/groups/join/:code', joinViaInvite);

// ─── Messages & Attachments ───────────────────────────────────────────────────

/**
 * @route   GET /api/chat/conversations/:id/messages
 * @desc    Paginated message history for a conversation (50 per page, oldest-first).
 *          Returns 403 if caller is not a participant.
 *          Phone numbers in message content are delivered verbatim.
 * @query   page
 * @access  Any approved user (participant only)
 */
router.get('/conversations/:id/messages', getMessages);

/**
 * @route   POST /api/chat/conversations/:id/attachment
 * @desc    Upload an attachment (image, PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX up to 10 MB).
 *          Streams file to Cloudinary and saves URL in MongoDB.
 * @access  Any approved conversation participant
 */
router.post('/conversations/:id/attachment', uploadAttachment, sendFileAttachment);

/**
 * @route   POST /api/chat/messages/:id/report
 * @desc    Report a message for inappropriate content, harassment, etc.
 *          Exempts message from auto-cleanup cron (sets isReported = true).
 * @body    { reason, details? }
 * @access  Any approved conversation participant
 */
router.post('/messages/:id/report', reportMessage);

module.exports = router;
