const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const AdminLog = require('../models/AdminLog');
const { sendExpoPushNotifications } = require('../utils/pushNotifications');

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

    // ── Push Notification Trigger for Account Status Change ─────────────
    (async () => {
      try {
        if (user.expoPushToken) {
          const adminUser = await User.findById(req.user.id).select('name');
          const adminName = adminUser ? adminUser.name : 'ClassBridge Admin';
          await sendExpoPushNotifications([
            {
              to: user.expoPushToken,
              title: adminName,
              body: 'Your account has been approved. You can now access ClassBridge.',
              data: { type: 'account_approved' },
            },
          ]);
        }
      } catch (pushErr) {
        console.error('[ADMIN] approveUser push notification error:', pushErr);
      }
    })();

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

    // ── Push Notification Trigger for Account Status Change ─────────────
    (async () => {
      try {
        if (user.expoPushToken) {
          const adminUser = await User.findById(req.user.id).select('name');
          const adminName = adminUser ? adminUser.name : 'ClassBridge Admin';
          await sendExpoPushNotifications([
            {
              to: user.expoPushToken,
              title: adminName,
              body: 'Your account signup application has been rejected.',
              data: { type: 'account_rejected' },
            },
          ]);
        }
      } catch (pushErr) {
        console.error('[ADMIN] rejectUser push notification error:', pushErr);
      }
    })();

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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN READ-ONLY CHAT MONITORING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/chat/conversations
 * List ALL 1-to-1 and group conversations across the system for monitoring.
 * Supports search (by user name or group name) and type filter (direct/group/all).
 * Admin view: phone numbers visible in participant objects.
 * Includes isParticipant flag so UI can display "Read-Only Monitoring" badge.
 * Admin/Super Admin only.
 */
async function listAllConversations(req, res) {
  try {
    const callerId = req.user.id;
    const { search, type, page = 1, limit = 20 } = req.query;

    const filter = {};

    if (type && ['direct', 'group'].includes(type)) {
      filter.type = type;
    }

    if (search && String(search).trim()) {
      const searchRegex = new RegExp(String(search).trim(), 'i');
      // Find matching users by name
      const matchingUsers = await User.find({ name: searchRegex }).select('_id');
      const matchingUserIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { name: searchRegex },
        { participants: { $in: matchingUserIds } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [conversations, total] = await Promise.all([
      Conversation.find(filter)
        .sort({ lastActivityAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('participants', 'name role email phone subject classGrade') // admin view: phone visible
        .populate({ path: 'lastMessage', select: 'content type createdAt sender isDeleted' })
        .lean(),
      Conversation.countDocuments(filter),
    ]);

    // Attach isParticipant flag for UI badge rendering
    const formatted = conversations.map((conv) => {
      const isParticipant = conv.participants.some(
        (p) => p._id.toString() === callerId
      );
      return {
        ...conv,
        isParticipant,
      };
    });

    return res.status(200).json({
      conversations: formatted,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[ADMIN] listAllConversations error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * GET /api/admin/chat/conversations/:id/messages
 * Read-only message history inspection for ANY conversation in the system.
 * Does NOT alter readBy array (silent inspection).
 * Admin/Super Admin only.
 */
async function getMonitoredMessages(req, res) {
  try {
    const { page = 1 } = req.query;
    const PAGE_SIZE = 50;

    const conversation = await Conversation.findById(req.params.id).select('name type participants');
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const skip = (pageNum - 1) * PAGE_SIZE;

    const [rawMessages, total] = await Promise.all([
      Message.find({ conversation: req.params.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE)
        .populate('sender', 'name role email phone subject classGrade') // admin view: phone visible
        .lean(),
      Message.countDocuments({ conversation: req.params.id }),
    ]);

    const messages = rawMessages.reverse();

    const sanitized = messages.map((m) => {
      if (m.isDeleted) {
        return { ...m, content: null, fileUrl: null, fileName: null, fileMimeType: null };
      }
      return m;
    });

    const isParticipant = conversation.participants.some(
      (p) => p.toString() === req.user.id
    );

    return res.status(200).json({
      conversation: {
        _id: conversation._id,
        name: conversation.name,
        type: conversation.type,
        isParticipant,
      },
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
    console.error('[ADMIN] getMonitoredMessages error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN REPORT MANAGEMENT QUEUE & ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

const MessageReport = require('../models/MessageReport');

/**
 * GET /api/admin/reports
 * List report review queue for admins.
 * Query params: status (pending|resolved|dismissed|all), page, limit.
 * Default status filter is 'pending'.
 */
async function listReports(req, res) {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status !== 'all') {
      const validStatuses = ['pending', 'resolved', 'dismissed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status filter. Must be one of: ${validStatuses.join(', ')} or "all".` });
      }
      filter.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [reports, total] = await Promise.all([
      MessageReport.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('reporter', 'name role email phone')
        .populate('reportedUser', 'name role email phone isBanned')
        .populate({
          path: 'message',
          select: 'content type fileUrl fileName isDeleted createdAt sender',
        })
        .populate('conversation', 'name type')
        .populate('resolvedBy', 'name role email')
        .lean(),
      MessageReport.countDocuments(filter),
    ]);

    return res.status(200).json({
      reports,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[ADMIN] listReports error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * GET /api/admin/reports/:id
 * Get single report detail with chat context (5 messages before and 5 messages after).
 */
async function getReportDetail(req, res) {
  try {
    const report = await MessageReport.findById(req.params.id)
      .populate('reporter', 'name role email phone')
      .populate('reportedUser', 'name role email phone isBanned status')
      .populate({
        path: 'message',
        select: 'content type fileUrl fileName isDeleted createdAt sender conversation',
      })
      .populate('conversation', 'name type participants')
      .populate('resolvedBy', 'name role email')
      .lean();

    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    // Fetch context messages (5 before, 5 after reported message timestamp)
    let contextMessages = [];
    if (report.message && report.message.createdAt) {
      const targetTime = report.message.createdAt;
      const conversationId = report.conversation._id || report.message.conversation;

      const [before, after] = await Promise.all([
        Message.find({
          conversation: conversationId,
          createdAt: { $lt: targetTime },
        })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('sender', 'name role email phone')
          .lean(),
        Message.find({
          conversation: conversationId,
          createdAt: { $gt: targetTime },
        })
          .sort({ createdAt: 1 })
          .limit(5)
          .populate('sender', 'name role email phone')
          .lean(),
      ]);

      // Combine in chronological order: before (reversed), target message, after
      contextMessages = [
        ...before.reverse(),
        report.message,
        ...after,
      ];
    }

    return res.status(200).json({
      report,
      contextMessages,
    });
  } catch (err) {
    console.error('[ADMIN] getReportDetail error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

/**
 * PATCH /api/admin/reports/:id/action
 * Perform a resolution action on a pending report.
 * Body: { action: 'dismiss' | 'delete_message' | 'ban_user' | 'resolve', adminNotes? }
 */
async function actionReport(req, res) {
  try {
    const { action, adminNotes } = req.body;
    const validActions = ['dismiss', 'delete_message', 'ban_user', 'resolve'];

    if (!action || !validActions.includes(action)) {
      return res.status(400).json({
        error: `action is required and must be one of: ${validActions.join(', ')}.`,
      });
    }

    const report = await MessageReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    if (report.status !== 'pending') {
      return res.status(400).json({ error: `Report is already ${report.status}.` });
    }

    const adminId = req.user.id;
    let logNote = adminNotes ? String(adminNotes).trim() : null;

    if (action === 'dismiss') {
      report.status = 'dismissed';
    } else if (action === 'delete_message') {
      report.status = 'resolved';
      const msg = await Message.findById(report.message);
      if (msg && !msg.isDeleted) {
        msg.isDeleted = true;
        msg.deletedAt = new Date();
        await msg.save();
      }
      // Audit log
      const reportedUserObj = await User.findById(report.reportedUser);
      if (reportedUserObj) {
        await writeLog({
          action: 'message_deleted_via_report',
          performedBy: adminId,
          targetUser: reportedUserObj,
          note: `Deleted message ${report.message} due to report. ${logNote || ''}`.trim(),
        });
      }
    } else if (action === 'ban_user') {
      report.status = 'resolved';
      const targetUser = await User.findById(report.reportedUser);
      if (targetUser && !targetUser.isBanned) {
        if (targetUser.role === 'superadmin') {
          return res.status(403).json({ error: 'Super Admin accounts cannot be banned.' });
        }
        if (req.user.role === 'admin' && targetUser.role === 'admin') {
          return res.status(403).json({ error: 'Admins cannot ban other Admin accounts.' });
        }
        targetUser.isBanned = true;
        targetUser.actionLog.push({ action: 'banned', performedBy: adminId });
        await targetUser.save();

        await writeLog({
          action: 'banned',
          performedBy: adminId,
          targetUser,
          note: `Banned via report action. ${logNote || ''}`.trim(),
        });
      }
    } else if (action === 'resolve') {
      report.status = 'resolved';
      const reportedUserObj = await User.findById(report.reportedUser);
      if (reportedUserObj) {
        await writeLog({
          action: 'report_resolved',
          performedBy: adminId,
          targetUser: reportedUserObj,
          note: `Resolved report. ${logNote || ''}`.trim(),
        });
      }
    }

    report.resolvedBy = adminId;
    report.resolvedAt = new Date();
    report.adminNotes = logNote;
    await report.save();

    return res.status(200).json({
      message: `Report successfully ${report.status} with action: ${action}.`,
      report,
    });
  } catch (err) {
    console.error('[ADMIN] actionReport error:', err);
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
  listAllConversations,
  getMonitoredMessages,
  listReports,
  getReportDetail,
  actionReport,
};

