const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * GroupInvite — Shareable invite link for joining group conversations.
 *
 * Requirements:
 *  - Optional expiry (expiresAt)
 *  - Optional max-uses limit (maxUses)
 *  - Joining user MUST be authenticated, approved (status === 'approved'),
 *    not banned (isBanned === false), and not locked (isLocked === false).
 */
const groupInviteSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => crypto.randomBytes(8).toString('hex'), // 16-char hex code
    },

    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'conversation is required.'],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'createdBy is required.'],
    },

    // Optional expiration date
    expiresAt: {
      type: Date,
      default: null,
    },

    // Optional maximum number of uses (null = unlimited)
    maxUses: {
      type: Number,
      default: null,
      min: [1, 'maxUses must be at least 1.'],
    },

    // Number of times this invite code has been successfully redeemed
    usesCount: {
      type: Number,
      default: 0,
    },

    // Tracking array of users who redeemed this invite
    usedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        usedAt: { type: Date, default: Date.now },
      },
    ],

    // Manual revocation flag
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const GroupInvite = mongoose.model('GroupInvite', groupInviteSchema);
module.exports = GroupInvite;
