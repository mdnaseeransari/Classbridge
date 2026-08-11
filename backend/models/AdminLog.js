const mongoose = require('mongoose');

/**
 * AdminLog — immutable audit record of every admin/superadmin action.
 *
 * Every write operation in the admin panel creates one of these documents.
 * Records are never deleted automatically (reported-message safety rule
 * applies here too — the audit trail must always survive).
 */
const adminLogSchema = new mongoose.Schema(
  {
    // The action that was performed
    action: {
      type: String,
      enum: [
        'approved',       // pending → approved
        'rejected',       // pending → rejected
        'banned',         // active user banned
        'unbanned',       // banned user restored
        'unlocked',       // login-locked account unlocked
        'deleted',        // user document hard-deleted
        'promoted',       // teacher/student → admin
        'created_admin',  // new admin account created directly by superadmin
        'password_reset_approved', // password/PIN reset request resolved
      ],
      required: [true, 'Action is required.'],
    },

    // Who performed the action (Admin or Super Admin)
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'performedBy is required.'],
    },

    // The user the action was performed on
    targetUser: {
      // Stored as ObjectId when the user still exists; after hard-delete
      // the ref is broken but the snapshot preserves the identity.
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Snapshot of the target's key fields at the time of the action.
    // Survives user deletion so the audit trail remains meaningful.
    targetSnapshot: {
      name: { type: String, default: null },
      role: { type: String, default: null },
      email: { type: String, default: null },
      // Phone intentionally stored here for admin audit trail only;
      // never exposed to teacher/student-facing APIs.
      phone: { type: String, default: null },
    },

    // Optional free-text note left by the admin
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Note must not exceed 500 characters.'],
      default: null,
    },
  },
  {
    timestamps: true,    // createdAt = when the action occurred
    // Prevent accidental updates — logs are append-only
    strict: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
adminLogSchema.index({ performedBy: 1, createdAt: -1 }); // "what did this admin do?"
adminLogSchema.index({ targetUser: 1, createdAt: -1 });  // "what happened to this user?"
adminLogSchema.index({ action: 1, createdAt: -1 });       // filter by action type
adminLogSchema.index({ createdAt: -1 });                  // general reverse-chron listing

const AdminLog = mongoose.model('AdminLog', adminLogSchema);

module.exports = AdminLog;
