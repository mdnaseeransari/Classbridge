const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  listUsers,
  getUser,
  approveUser,
  rejectUser,
  banUser,
  unbanUser,
  unlockUser,
  deleteUser,
  createAdmin,
  promoteToAdmin,
  getAdminLogs,
  listAllConversations,
  getMonitoredMessages,
  listReports,
  getReportDetail,
  actionReport,
  deleteReport,
  listResetRequests,
  resolveResetRequest,
  resetUserPin,
  listPinResetRequests,
  approvePinResetRequest,
  rejectPinResetRequest,
} = require('../controllers/adminController');
const validateObjectId = require('../middleware/validateObjectId');
const rateLimit = require('express-rate-limit');

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // max 3 reset attempts per hour per IP
  message: { 
    error: 'Too many reset attempts. Try again in 1 hour.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

// All admin routes require a valid JWT + at minimum the 'admin' role.
// Individual endpoints that require 'superadmin' apply a second requireRole guard.
router.use(authenticate, requireRole('admin', 'superadmin'));

// ─── User Management (Admin + Super Admin) ────────────────────────────────────

/**
 * @route   GET /api/admin/users
 * @desc    List all users. Query params: role, status, page, limit.
 * @access  admin | superadmin
 */
router.get('/users', listUsers);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get a single user's full profile (phone visible).
 * @access  admin | superadmin
 */
router.get('/users/:id', validateObjectId('id'), getUser);

/**
 * @route   PATCH /api/admin/users/:id/approve
 * @desc    Approve a pending signup.
 * @body    { note? }
 * @access  admin | superadmin
 */
router.patch('/users/:id/approve', validateObjectId('id'), approveUser);

/**
 * @route   PATCH /api/admin/users/:id/reject
 * @desc    Reject a pending or approved user.
 * @body    { note? }
 * @access  admin | superadmin
 */
router.patch('/users/:id/reject', validateObjectId('id'), rejectUser);

/**
 * @route   PATCH /api/admin/users/:id/ban
 * @desc    Ban a user. Blocks all subsequent API access immediately.
 * @body    { note? }
 * @access  admin | superadmin
 */
router.patch('/users/:id/ban', validateObjectId('id'), banUser);

/**
 * @route   PATCH /api/admin/users/:id/unban
 * @desc    Remove a ban from a user.
 * @body    { note? }
 * @access  admin | superadmin
 */
router.patch('/users/:id/unban', validateObjectId('id'), unbanUser);

/**
 * @route   PATCH /api/admin/users/:id/unlock
 * @desc    Clear login lockout caused by too many failed PIN/password attempts.
 * @body    { note? }
 * @access  admin | superadmin
 */
router.patch('/users/:id/unlock', validateObjectId('id'), unlockUser);

/**
 * @route   PATCH /api/admin/users/:id/reset-pin
 * @desc    Reset a user's PIN to a temporary random 6-digit PIN.
 * @access  admin | superadmin
 */
router.patch('/users/:id/reset-pin', resetLimiter, validateObjectId('id'), resetUserPin);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Hard-delete a user. Audit snapshot is preserved in AdminLog.
 *          Cannot delete superadmin or self. Admin cannot delete another admin.
 * @body    { note? }
 * @access  admin | superadmin
 */
router.delete('/users/:id', validateObjectId('id'), deleteUser);

// ─── Super Admin–only actions ─────────────────────────────────────────────────
// requireRole('superadmin') is a SECOND guard — even if a regular admin somehow
// bypasses the outer middleware, these routes will still reject them with 403.

/**
 * @route   POST /api/admin/users
 * @desc    Create a new Admin account directly (email + password).
 *          Rejected at the API level for any caller whose role is not superadmin.
 * @body    { name, email, password }
 * @access  superadmin ONLY
 */
router.post('/users', requireRole('superadmin'), createAdmin);

/**
 * @route   PATCH /api/admin/users/:id/promote
 * @desc    Promote an existing Teacher or Student to Admin.
 *          Requires supplying a new email + password for admin login.
 *          Rejected at the API level for any caller whose role is not superadmin.
 * @body    { email, password, note? }
 * @access  superadmin ONLY
 */
router.patch('/users/:id/promote', requireRole('superadmin'), validateObjectId('id'), promoteToAdmin);

// ─── Audit Logs ───────────────────────────────────────────────────────────────

/**
 * @route   GET /api/admin/logs
 * @desc    View admin action audit log. Query params: action, performedBy, targetUser, page, limit.
 * @access  admin | superadmin
 */
router.get('/logs', getAdminLogs);

// ─── Chat Read-Only Monitoring ────────────────────────────────────────────────

/**
 * @route   GET /api/admin/chat/conversations
 * @desc    List all 1-to-1 and group conversations for read-only inspection.
 *          Query params: search, type (direct|group|all), page, limit.
 *          Includes isParticipant boolean flag.
 * @access  admin | superadmin
 */
router.get('/chat/conversations', listAllConversations);

/**
 * @route   GET /api/admin/chat/conversations/:id/messages
 * @desc    Read-only message history inspection for ANY conversation in the system.
 *          Does not update read receipts.
 * @access  admin | superadmin
 */
router.get('/chat/conversations/:id/messages', validateObjectId('id'), getMonitoredMessages);

// ─── Message Report Review Queue & Actions ─────────────────────────────────────

/**
 * @route   GET /api/admin/reports
 * @desc    List report review queue. Query params: status (pending|resolved|dismissed|all), page, limit.
 * @access  admin | superadmin
 */
router.get('/reports', listReports);

/**
 * @route   GET /api/admin/reports/:id
 * @desc    Get single report detail with chat context (5 messages before, 5 messages after).
 * @access  admin | superadmin
 */
router.get('/reports/:id', validateObjectId('id'), getReportDetail);

/**
 * @route   PATCH /api/admin/reports/:id/action
 * @desc    Take action on a report: dismiss, delete_message, ban_user, or resolve.
 * @body    { action: 'dismiss' | 'delete_message' | 'ban_user' | 'resolve', adminNotes? }
 * @access  admin | superadmin
 */
router.patch('/reports/:id/action', validateObjectId('id'), actionReport);
router.delete('/reports/:id', validateObjectId('id'), deleteReport);

// ─── Password Reset Request Queue & Actions ─────────────────────────────────────

/**
 * @route   GET /api/admin/reset-requests
 * @desc    List pending password/PIN reset requests.
 * @access  admin | superadmin
 */
router.get('/reset-requests', listResetRequests);

/**
 * @route   POST /api/admin/reset-requests/:id/resolve
 * @desc    Approve or reject a password/PIN reset request.
 * @body    { action: 'approve' | 'reject', customCredential? }
 * @access  admin | superadmin
 */
router.post('/reset-requests/:id/resolve', validateObjectId('id'), resolveResetRequest);

// ─── PIN Reset Request Queue & Actions ──────────────────────────────────────────

/**
 * @route   GET /api/admin/pin-reset-requests
 * @desc    List pending PIN reset requests.
 * @access  admin | superadmin
 */
router.get('/pin-reset-requests', listPinResetRequests);

/**
 * @route   PATCH /api/admin/pin-reset-requests/:id/approve
 * @desc    Approve a PIN reset request.
 * @access  admin | superadmin
 */
router.patch('/pin-reset-requests/:id/approve', resetLimiter, validateObjectId('id'), approvePinResetRequest);

/**
 * @route   PATCH /api/admin/pin-reset-requests/:id/reject
 * @desc    Reject a PIN reset request.
 * @access  admin | superadmin
 */
router.patch('/pin-reset-requests/:id/reject', validateObjectId('id'), rejectPinResetRequest);

module.exports = router;
