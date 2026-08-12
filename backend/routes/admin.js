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
} = require('../controllers/adminController');

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
router.get('/users/:id', getUser);

/**
 * @route   PATCH /api/admin/users/:id/approve
 * @desc    Approve a pending signup.
 * @body    { note? }
 * @access  admin | superadmin
 */
router.patch('/users/:id/approve', approveUser);

/**
 * @route   PATCH /api/admin/users/:id/reject
 * @desc    Reject a pending or approved user.
 * @body    { note? }
 * @access  admin | superadmin
 */
router.patch('/users/:id/reject', rejectUser);

/**
 * @route   PATCH /api/admin/users/:id/ban
 * @desc    Ban a user. Blocks all subsequent API access immediately.
 * @body    { note? }
 * @access  admin | superadmin
 */
router.patch('/users/:id/ban', banUser);

/**
 * @route   PATCH /api/admin/users/:id/unban
 * @desc    Remove a ban from a user.
 * @body    { note? }
 * @access  admin | superadmin
 */
router.patch('/users/:id/unban', unbanUser);

/**
 * @route   PATCH /api/admin/users/:id/unlock
 * @desc    Clear login lockout caused by too many failed PIN/password attempts.
 * @body    { note? }
 * @access  admin | superadmin
 */
router.patch('/users/:id/unlock', unlockUser);

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Hard-delete a user. Audit snapshot is preserved in AdminLog.
 *          Cannot delete superadmin or self. Admin cannot delete another admin.
 * @body    { note? }
 * @access  admin | superadmin
 */
router.delete('/users/:id', deleteUser);

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
router.patch('/users/:id/promote', requireRole('superadmin'), promoteToAdmin);

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
router.get('/chat/conversations/:id/messages', getMonitoredMessages);

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
router.get('/reports/:id', getReportDetail);

/**
 * @route   PATCH /api/admin/reports/:id/action
 * @desc    Take action on a report: dismiss, delete_message, ban_user, or resolve.
 * @body    { action: 'dismiss' | 'delete_message' | 'ban_user' | 'resolve', adminNotes? }
 * @access  admin | superadmin
 */
router.patch('/reports/:id/action', actionReport);
router.delete('/reports/:id', deleteReport);

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
router.post('/reset-requests/:id/resolve', resolveResetRequest);

module.exports = router;
