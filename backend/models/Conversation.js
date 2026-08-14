const mongoose = require('mongoose');

/**
 * Conversation — represents either a 1-to-1 direct chat or a group chat thread.
 *
 * For direct chats:
 *   - type = 'direct'
 *   - participants = exactly 2 users
 *   - participantPair = sorted composite key of the two user IDs for fast dedup lookup
 *   - Visibility rule: only the two participants can access this document
 *
 * For group chats (built later):
 *   - type = 'group'
 *   - participantPair = null
 *   - Visible to any Admin/Super Admin
 */
const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: { values: ['direct', 'group'], message: 'type must be "direct" or "group".' },
      required: true,
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    /**
     * Canonical deduplication key for direct conversations only.
     * Computed as: [userId1, userId2].sort().join('_')
     * Ensures only one DM thread can exist between any two users.
     */
    participantPair: {
      type: String,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Snapshot of the most recent message for conversation list previews
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },

    // Updated every time a message is sent; used to sort the conversation list
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },

    // Group-only fields (unused for direct chats)
    name: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },
    hiddenFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: undefined,
      },
    ],
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Fast lookup for "does a DM between these two users already exist?"
conversationSchema.index({ participantPair: 1 }, { unique: true, sparse: true });
// List all conversations a user is part of, newest activity first
conversationSchema.index({ participants: 1, lastActivityAt: -1 });
// List all group conversations (for admin monitoring)
conversationSchema.index({ type: 1, lastActivityAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
