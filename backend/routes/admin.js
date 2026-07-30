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

module.exports = router;
