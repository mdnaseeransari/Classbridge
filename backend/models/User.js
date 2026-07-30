const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters.'],
      maxlength: [100, 'Name must not exceed 100 characters.'],
    },

    phone: {
      type: String,
      required: [true, 'Phone number is required.'],
      unique: true,
      trim: true,
      match: [/^\+?[1-9]\d{6,14}$/, 'Please provide a valid phone number.'],
    },

    pin: {
      type: String,
      required: [true, 'PIN is required.'],
      // Raw value is a 6-digit string; stored as bcrypt hash.
      // Validation of the raw format is done at the controller level before hashing.
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
// phone uniqueness is enforced by the unique: true above; this explicit index
// also speeds up login lookups by phone.
userSchema.index({ phone: 1 });
userSchema.index({ role: 1, status: 1 }); // supports admin "filter by role/status" queries

// ─── Pre-save hook: hash PIN before storing ────────────────────────────────────
userSchema.pre('save', async function (next) {
  // Only re-hash if the pin field was actually modified (avoids double-hashing on other saves)
  if (!this.isModified('pin')) return next();

  try {
    this.pin = await bcrypt.hash(this.pin, SALT_ROUNDS);
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
  return bcrypt.compare(candidatePin, this.pin);
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
  const projection = { pin: 0, __v: 0 };
  if (!isAdmin) {
    projection.phone = 0;
  }
  return projection;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
