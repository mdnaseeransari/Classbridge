const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

// Roles that authenticate via phone + PIN
const PHONE_PIN_ROLES = ['teacher', 'student'];
// Roles that authenticate via email + password
const EMAIL_PASSWORD_ROLES = ['superadmin', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters.'],
      maxlength: [100, 'Name must not exceed 100 characters.'],
    },

    // ── Teacher / Student credentials ──────────────────────────────────────────
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[1-9]\d{6,14}$/, 'Please provide a valid phone number.'],
      // Required only for teacher/student; validated in controller for those roles.
      default: null,
    },

    pin: {
      type: String,
      // Raw value must be a 6-digit string; validated & hashed in controller before save.
      default: null,
    },

    // ── Admin / Super Admin credentials ─────────────────────────────────────────
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address.'],
      // Required only for admin/superadmin; validated in controller for those roles.
      default: null,
    },

    password: {
      type: String,
      // Stored as bcrypt hash. Raw format validated in controller before hashing.
      default: null,
    },

    role: {
      type: String,
      enum: {
        values: ['superadmin', 'admin', 'teacher', 'student'],
        message: 'Role must be one of: superadmin, admin, teacher, student.',
      },
      required: [true, 'Role is required.'],
    },

    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected'],
        message: 'Status must be one of: pending, approved, rejected.',
      },
      // superadmin and admin accounts are approved immediately on creation/seed;
      // teacher and student accounts start as pending until an admin approves.
      default: 'pending',
    },

    // Teacher-only field
    subject: {
      type: String,
      trim: true,
      maxlength: [100, 'Subject must not exceed 100 characters.'],
      default: null,
    },

    // Student-only field
    classGrade: {
      type: String,
      trim: true,
      maxlength: [50, 'Class/grade must not exceed 50 characters.'],
      default: null,
    },

    // Login security: tracks consecutive failed login attempts.
    // When failedLoginAttempts reaches 5 the account is locked.
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },

    // Set to true after 5 consecutive failed logins; cleared only by admin/superadmin.
    isLocked: {
      type: Boolean,
      default: false,
    },

    // Set to true when an admin/superadmin explicitly bans the user.
    // Separate from isLocked (login lockout) — ban is a deliberate admin action,
    // lockout is automatic after failed attempts.
    isBanned: {
      type: Boolean,
      default: false,
    },

    // Expo push token for mobile push notifications
    expoPushToken: {
      type: String,
      default: null,
      trim: true,
    },

    // Tracks who approved/rejected/locked/unlocked this user and when.
    // Populated by admin action; null until an action is taken.
    actionLog: [
      {
        action: {
          type: String,
          enum: ['approved', 'rejected', 'banned', 'unbanned', 'unlocked', 'promoted'],
        },
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        performedAt: {
          type: Date,
          default: Date.now,
        },
        note: {
          type: String,
          trim: true,
          maxlength: 300,
        },
      },
    ],
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
// sparse: true allows multiple documents to have phone: null without violating uniqueness.
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
// sparse: true allows multiple documents to have email: null (all teacher/student rows).
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, status: 1 }); // supports admin "filter by role/status" queries

// ─── Pre-save hook: hash PIN and/or password before storing ──────────────────
userSchema.pre('save', async function (next) {
  try {
    if (this.isModified('pin') && this.pin) {
      this.pin = await bcrypt.hash(this.pin, SALT_ROUNDS);
    }
    if (this.isModified('password') && this.password) {
      this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    }
    return next();
  } catch (err) {
    return next(err);
  }
});

// ─── Instance method: compare a candidate PIN against the stored hash ──────────
/**
 * @param {string} candidatePin - The raw 6-digit PIN provided at login.
 * @returns {Promise<boolean>} true if the PIN matches, false otherwise.
 */
userSchema.methods.comparePin = async function (candidatePin) {
  if (!this.pin) return false;
  return bcrypt.compare(String(candidatePin), this.pin);
};

// ─── Instance method: compare a candidate password against the stored hash ─────
/**
 * @param {string} candidatePassword - The raw password provided at login.
 * @returns {Promise<boolean>} true if the password matches, false otherwise.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(String(candidatePassword), this.password);
};

// ─── Instance method: validate role-specific fields ───────────────────────────
/**
 * Returns a validation error string if role-specific fields are missing,
 * or null if everything is fine.
 * Call this in the signup controller before saving.
 */
userSchema.methods.validateRoleFields = function () {
  if (this.role === 'teacher' && !this.subject) {
    return 'Subject is required for teacher accounts.';
  }
  if (this.role === 'student' && !this.classGrade) {
    return 'Class/grade is required for student accounts.';
  }
  return null;
};

// ─── Static method: safe projection — strips phone & pin from query results ───
/**
 * Returns a field projection object that excludes sensitive fields.
 * Pass to .select() or as the projection arg in .find().
 *
 * @param {boolean} isAdmin - If true, phone IS included (admin view). Default false.
 */
userSchema.statics.safeProjection = function (isAdmin = false) {
  const projection = { pin: 0, password: 0, __v: 0 };
  if (!isAdmin) {
    projection.phone = 0;
  }
  return projection;
};

// ─── Exported role helpers ──────────────────────────────────────────────────
userSchema.statics.PHONE_PIN_ROLES = PHONE_PIN_ROLES;
userSchema.statics.EMAIL_PASSWORD_ROLES = EMAIL_PASSWORD_ROLES;

const User = mongoose.model('User', userSchema);

module.exports = User;
