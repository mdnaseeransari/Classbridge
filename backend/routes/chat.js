const express = require('express');
const { authenticate } = require('../middleware/auth');
const { uploadAttachment } = require('../middleware/upload');
const validateObjectId = require('../middleware/validateObjectId');
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
  hideConversation,
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
 * @route   GET /api/chat/admins
 * @desc    List all active admins/superadmins (for messaging by teachers/students).
 * @access  Any approved user
 */
router.get('/admins', listAdmins);

/**
 * @route   GET /api/chat/contacts
 * @desc    List all approved, active DM-eligible contacts for the authenticated user.
 * @access  Any approved user
 */
router.get('/contacts', listContacts);

/**
 * @route   GET /api/chat/conversations/:id
 * @desc    Get a single conversation. Returns 403 if caller is not a participant.
 * @access  Any approved user (participant only)
 */
router.get('/conversations/:id', validateObjectId('id'), getConversation);

/**
 * @route   POST /api/chat/conversations/:id/pin
 * @desc    Pin a conversation to the top.
 * @access  Any participant
 */
router.post('/conversations/:id/pin', validateObjectId('id'), pinConversation);

/**
 * @route   POST /api/chat/conversations/:id/unpin
 * @desc    Unpin a conversation.
 * @access  Any participant
 */
router.post('/conversations/:id/unpin', validateObjectId('id'), unpinConversation);

/**
 * @route   POST /api/chat/conversations/:id/archive
 * @desc    Archive a conversation.
 * @access  Any participant
 */
router.post('/conversations/:id/archive', validateObjectId('id'), archiveConversation);

/**
 * @route   POST /api/chat/conversations/:id/unarchive
 * @desc    Unarchive a conversation.
 * @access  Any participant
 */
router.post('/conversations/:id/unarchive', validateObjectId('id'), unarchiveConversation);

/**
 * @route   POST /api/chat/conversations/:id/mute
 * @desc    Mute a conversation.
 * @access  Any participant
 */
router.post('/conversations/:id/mute', validateObjectId('id'), muteConversation);

/**
 * @route   POST /api/chat/conversations/:id/unmute
 * @desc    Unmute a conversation.
 * @access  Any participant
 */
router.post('/conversations/:id/unmute', validateObjectId('id'), unmuteConversation);

/**
 * @route   GET /api/chat/conversations/:id/search
 * @desc    Search messages in a conversation.
 * @access  Any participant
 */
router.get('/conversations/:id/search', validateObjectId('id'), searchMessages);

/**
 * @route   DELETE /api/chat/conversations/:id/hide
 * @desc    Hide a conversation from the caller's conversation list.
 * @access  Any participant
 */
router.delete('/conversations/:id/hide', validateObjectId('id'), hideConversation);

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
router.patch('/groups/:id', validateObjectId('id'), updateGroup);

/**
 * @route   DELETE /api/chat/groups/:id
 * @desc    Delete a group chat.
 * @access  Admin / Super Admin only
 */
router.delete('/groups/:id', validateObjectId('id'), deleteGroup);

/**
 * @route   POST /api/chat/groups/:id/members
 * @desc    Add members to a group chat.
 * @access  Admin / Super Admin only
 */
router.post('/groups/:id/members', validateObjectId('id'), addGroupMembers);

/**
 * @route   DELETE /api/chat/groups/:id/members/:userId
 * @desc    Remove a member from a group chat.
 * @access  Admin / Super Admin only
 */
router.delete('/groups/:id/members/:userId', validateObjectId('id', 'userId'), removeGroupMember);

/**
 * @route   GET /api/chat/groups/:id/members
 * @desc    Get member list for a group. Omits phone numbers for non-admin callers.
 * @access  Group participant or Admin / Super Admin
 */
router.get('/groups/:id/members', validateObjectId('id'), getGroupMembers);

// ─── Group Invite Links ───────────────────────────────────────────────────────

/**
 * @route   POST /api/chat/groups/:id/invites
 * @desc    Generate a shareable invite link with optional expiry/max-uses.
 * @access  Admin / Super Admin only
 */
router.post('/groups/:id/invites', validateObjectId('id'), createInviteLink);

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
router.get('/conversations/:id/messages', validateObjectId('id'), getMessages);

/**
 * @route   POST /api/chat/conversations/:id/attachment
 * @desc    Upload an attachment (image, PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX up to 10 MB).
 *          Streams file to Cloudinary and saves URL in MongoDB.
 * @access  Any approved conversation participant
 */
router.post('/conversations/:id/attachment', validateObjectId('id'), uploadAttachment, sendFileAttachment);

/**
 * @route   POST /api/chat/messages/:id/report
 * @desc    Report a message for inappropriate content, harassment, etc.
 *          Exempts message from auto-cleanup cron (sets isReported = true).
 * @body    { reason, details? }
 * @access  Any approved conversation participant
 */
router.post('/messages/:id/report', validateObjectId('id'), reportMessage);

/**
 * @route   PATCH /api/chat/messages/:id
 * @desc    Edit text content of a message (sender only).
 * @body    { content }
 * @access  Sender of the message
 */
router.patch('/messages/:id', validateObjectId('id'), editMessage);

/**
 * @route   DELETE /api/chat/messages/:id
 * @desc    Soft-delete a message (sender or admin only).
 * @access  Sender or Admin/Super Admin
 */
router.delete('/messages/:id', validateObjectId('id'), deleteMessage);

/**
 * @route   POST /api/chat/messages/:id/forward
 * @desc    Forward a message to another conversation.
 * @body    { conversationId }
 * @access  Any approved conversation participant
 */
router.post('/messages/:id/forward', validateObjectId('id'), forwardMessage);

module.exports = router;
