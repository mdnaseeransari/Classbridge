const User = require('../models/User');
const AdminLog = require('../models/AdminLog');

// ─── Helper: build a snapshot of the target user for the audit log ────────────
function buildSnapshot(user) {
  return {
    name: user.name || null,
    role: user.role || null,
    email: user.email || null,
    phone: user.phone || null, // stored in audit log for admin trail only
  };
}

// ─── Helper: write one AdminLog entry ────────────────────────────────────────
async function writeLog({ action, performedBy, targetUser, note }) {
  await AdminLog.create({
    action,
    performedBy,
    targetUser: targetUser._id,
    targetSnapshot: buildSnapshot(targetUser),
    note: note || null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users
// List all users. Supports query filters: role, status.
// Paginates with page + limit query params.
// Admin/Super Admin only.
// ─────────────────────────────────────────────────────────────────────────────
async function listUsers(req, res) {
  try {
    const { role, status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (role) {
      const validRoles = ['superadmin', 'admin', 'teacher', 'student'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: `Invalid role filter. Must be one of: ${validRoles.join(', ')}.` });
      }
      filter.role = role;
    }
    if (status) {
      const validStatuses = ['pending', 'approved', 'rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status filter. Must be one of: ${validStatuses.join(', ')}.` });
      }
      filter.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Admin view: include phone; strip pin and password always
    const [users, total] = await Promise.all([
      User.find(filter, { pin: 0, password: 0, __v: 0 })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      users,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[ADMIN] listUsers error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/users/:id
// Fetch a single user's full profile (admin view, phone visible).
// Admin/Super Admin only.
// ─────────────────────────────────────────────────────────────────────────────
async function getUser(req, res) {
  try {
    const user = await User.findById(req.params.id, { pin: 0, password: 0, __v: 0 }).lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.status(200).json({ user });
  } catch (err) {
    console.error('[ADMIN] getUser error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/users/:id/approve
// Approve a pending signup.
// Admin/Super Admin only.
// ─────────────────────────────────────────────────────────────────────────────
async function approveUser(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.role === 'superadmin') {
      return res.status(403).json({ error: 'Super Admin accounts cannot be modified this way.' });
    }
    if (user.status !== 'pending') {
      return res.status(400).json({ error: `User status is already "${user.status}". Only pending users can be approved.` });
    }

    user.status = 'approved';
    user.actionLog.push({ action: 'approved', performedBy: req.user.id });
    await user.save();

    await writeLog({ action: 'approved', performedBy: req.user.id, targetUser: user, note: req.body.note });

    return res.status(200).json({ message: 'User approved successfully.', userId: user._id });
  } catch (err) {
    console.error('[ADMIN] approveUser error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/users/:id/reject
// Reject a pending signup.
// Admin/Super Admin only.
// ─────────────────────────────────────────────────────────────────────────────
async function rejectUser(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.role === 'superadmin') {
      return res.status(403).json({ error: 'Super Admin accounts cannot be modified this way.' });
    }
    if (user.status === 'rejected') {
      return res.status(400).json({ error: 'User is already rejected.' });
    }

    user.status = 'rejected';
    user.actionLog.push({ action: 'rejected', performedBy: req.user.id });
    await user.save();

    await writeLog({ action: 'rejected', performedBy: req.user.id, targetUser: user, note: req.body.note });

    return res.status(200).json({ message: 'User rejected successfully.', userId: user._id });
  } catch (err) {
    console.error('[ADMIN] rejectUser error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/users/:id/ban
// Ban a user (sets isBanned: true). Banned users are blocked by JWT middleware.
// Admin/Super Admin only.
// ─────────────────────────────────────────────────────────────────────────────
async function banUser(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.role === 'superadmin') {
      return res.status(403).json({ error: 'Super Admin accounts cannot be banned.' });
    }
    // A regular Admin cannot ban another Admin
    if (req.user.role === 'admin' && user.role === 'admin') {
      return res.status(403).json({ error: 'Admins cannot ban other Admin accounts.' });
    }
    if (user.isBanned) {
      return res.status(400).json({ error: 'User is already banned.' });
    }

    user.isBanned = true;
    user.actionLog.push({ action: 'banned', performedBy: req.user.id });
    await user.save();

    await writeLog({ action: 'banned', performedBy: req.user.id, targetUser: user, note: req.body.note });

    return res.status(200).json({ message: 'User banned successfully.', userId: user._id });
  } catch (err) {
    console.error('[ADMIN] banUser error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/users/:id/unban
// Remove a ban from a user.
// Admin/Super Admin only.
// ─────────────────────────────────────────────────────────────────────────────
async function unbanUser(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!user.isBanned) {
      return res.status(400).json({ error: 'User is not banned.' });
    }

    user.isBanned = false;
    user.actionLog.push({ action: 'unbanned', performedBy: req.user.id });
    await user.save();

    await writeLog({ action: 'unbanned', performedBy: req.user.id, targetUser: user, note: req.body.note });

    return res.status(200).json({ message: 'User unbanned successfully.', userId: user._id });
  } catch (err) {
    console.error('[ADMIN] unbanUser error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/users/:id/unlock
// Clear login lockout (isLocked + failedLoginAttempts reset).
// Admin/Super Admin only.
// ─────────────────────────────────────────────────────────────────────────────
async function unlockUser(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!user.isLocked) {
      return res.status(400).json({ error: 'User account is not locked.' });
    }

    user.isLocked = false;
    user.failedLoginAttempts = 0;
    user.actionLog.push({ action: 'unlocked', performedBy: req.user.id });
    await user.save();

    await writeLog({ action: 'unlocked', performedBy: req.user.id, targetUser: user, note: req.body.note });

    return res.status(200).json({ message: 'User account unlocked successfully.', userId: user._id });
  } catch (err) {
    console.error('[ADMIN] unlockUser error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/users/:id
// Hard-delete a user document. The AdminLog snapshot preserves their identity.
// Admin/Super Admin only. Cannot delete Super Admin or self.
// ─────────────────────────────────────────────────────────────────────────────
async function deleteUser(req, res) {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.role === 'superadmin') {
      return res.status(403).json({ error: 'Super Admin accounts cannot be deleted.' });
    }
    // Regular admin cannot delete another admin
    if (req.user.role === 'admin' && user.role === 'admin') {
      return res.status(403).json({ error: 'Admins cannot delete other Admin accounts.' });
    }

    // Write log BEFORE deleting so targetUser ObjectId is still valid
    await writeLog({ action: 'deleted', performedBy: req.user.id, targetUser: user, note: req.body.note });

    await User.findByIdAndDelete(req.params.id);

    return res.status(200).json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('[ADMIN] deleteUser error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/users
// Create a brand-new Admin account directly.
// SUPER ADMIN ONLY — enforced at the route level with requireRole('superadmin').
// ─────────────────────────────────────────────────────────────────────────────
async function createAdmin(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const newAdmin = new User({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password, // hashed by pre-save hook
      role: 'admin',
      status: 'approved', // admin accounts are active immediately
    });

    await newAdmin.save();

    await writeLog({ action: 'created_admin', performedBy: req.user.id, targetUser: newAdmin });

    return res.status(201).json({
      message: 'Admin account created successfully.',
      user: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        role: newAdmin.role,
        status: newAdmin.status,
        createdAt: newAdmin.createdAt,
      },
    });
  } catch (err) {
    console.error('[ADMIN] createAdmin error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/admin/users/:id/promote
// Promote an existing Teacher or Student to Admin role.
// SUPER ADMIN ONLY — enforced at the route level with requireRole('superadmin').
// ─────────────────────────────────────────────────────────────────────────────
async function promoteToAdmin(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (!['teacher', 'student'].includes(user.role)) {
      return res.status(400).json({
        error: `Only Teacher or Student accounts can be promoted to Admin. Current role: "${user.role}".`,
      });
    }
    if (user.status !== 'approved') {
      return res.status(400).json({ error: 'Only approved accounts can be promoted.' });
    }

    // An admin account uses email + password auth; the promoted user must supply
    // these via the request body since their existing credential type is phone + PIN.
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        error: 'Promoting a user to Admin requires providing a new email and password for admin login.',
      });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const emailExists = await User.findOne({ email: email.trim().toLowerCase(), _id: { $ne: user._id } });
    if (emailExists) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const previousRole = user.role;
    user.role = 'admin';
    user.email = email.trim().toLowerCase();
    user.password = password; // hashed by pre-save hook
    user.actionLog.push({ action: 'promoted', performedBy: req.user.id });
    await user.save();

    await writeLog({
      action: 'promoted',
      performedBy: req.user.id,
      targetUser: user,
      note: `Promoted from ${previousRole} to admin.`,
    });

    return res.status(200).json({
      message: `User promoted from ${previousRole} to Admin successfully.`,
      userId: user._id,
    });
  } catch (err) {
    console.error('[ADMIN] promoteToAdmin error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/logs
// View admin action logs. Filterable by action, performedBy, targetUser.
// Admin/Super Admin only.
// ─────────────────────────────────────────────────────────────────────────────
async function getAdminLogs(req, res) {
  try {
    const { action, performedBy, targetUser, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (action) filter.action = action;
    if (performedBy) filter.performedBy = performedBy;
    if (targetUser) filter.targetUser = targetUser;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AdminLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('performedBy', 'name role email')
        .lean(),
      AdminLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[ADMIN] getAdminLogs error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = {
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
};
