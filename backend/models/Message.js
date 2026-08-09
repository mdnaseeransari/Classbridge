const mongoose = require('mongoose');

/**
 * Message — a single message within a Conversation.
 *
 * Privacy rules enforced at the API/socket layer (not here):
 *  - sender.phone is NEVER included in responses to Teacher/Student callers.
 *  - message content (including phone numbers typed as text) is delivered as-is.
 *
 * Deletion policy:
 *  - Messages are soft-deleted (isDeleted = true) rather than hard-deleted.
 *  - Reported messages (isReported = true) are NEVER auto-deleted by the cron job.
 */
const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'conversation is required.'],
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'sender is required.'],
    },

    // Plain text content. Emoji are stored as Unicode characters without any
    // special handling — they are just text. Phone numbers in message text
    // are stored and delivered verbatim (no stripping or blocking).
    content: {
      type: String,
      trim: true,
      maxlength: [5000, 'Message cannot exceed 5000 characters.'],
      default: null,
    },

    type: {
      type: String,
      enum: { values: ['text', 'file'], message: 'type must be "text" or "file".' },
      default: 'text',
    },

    // File attachment fields (populated for type = 'file'; null for text messages)
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileMimeType: { type: String, default: null },
    fileSizeBytes: { type: Number, default: null },

    /**
     * Read receipts.
     * Each entry records which user read the message and when.
     * The sender is not included — they obviously "read" their own message.
     */
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Soft-delete. A deleted message still exists in the DB but content is wiped.
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },

    // Edit indicator fields
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },

    // Quoted reply reference
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },

    // Forward indicator fields
    forwardedFrom: {
      type: Boolean,
      default: false,
    },

    // Report flags (managed by the report feature, built later).
    // A reported message is EXCLUDED from the automatic 6-month / last-50 cleanup.
    isReported: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Primary query pattern: "get messages for conversation X, newest first"
messageSchema.index({ conversation: 1, createdAt: -1 });
// Bulk read-receipt update: "mark all unread messages in conversation X as read"
messageSchema.index({ conversation: 1, 'readBy.user': 1 });
// Admin cleanup cron: filter on isReported + createdAt
messageSchema.index({ conversation: 1, isReported: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
