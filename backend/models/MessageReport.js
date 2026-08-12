const mongoose = require('mongoose');

/**
 * MessageReport — records a user's flag/report against a specific message.
 *
 * Lifecycle:
 *   pending  → resolved (admin took action: delete_message, ban_user, or generic resolve)
 *   pending  → dismissed (admin dismissed as not actionable)
 *
 * Cron safety:
 *   When a report is filed, the referenced Message.isReported is set to true.
 *   That flag permanently exempts the message from the automated cleanup cron —
 *   even if the report is later dismissed.
 */
const messageReportSchema = new mongoose.Schema(
  {
    // The message being reported
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: [true, 'message is required.'],
    },

    // Denormalised so admin queue queries don't need a join to Message
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'conversation is required.'],
    },

    // User who filed the report
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'reporter is required.'],
    },

    // Sender of the reported message (populated at report-creation time)
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'reportedUser is required.'],
    },

    // Structured reason — keeps the queue filterable
    reason: {
      type: String,
      enum: {
        values: [
          'inappropriate_content',
          'harassment',
          'contact_exchange',
          'spam',
          'other',
        ],
        message: 'reason must be one of: inappropriate_content, harassment, contact_exchange, spam, other.',
      },
      required: [true, 'reason is required.'],
    },

    // Optional free-text elaboration from the reporter
    details: {
      type: String,
      trim: true,
      maxlength: [1000, 'details cannot exceed 1000 characters.'],
      default: null,
    },

    // Workflow state
    status: {
      type: String,
      enum: {
        values: ['pending', 'resolved', 'dismissed'],
        message: 'status must be one of: pending, resolved, dismissed.',
      },
      default: 'pending',
    },

    // Resolution metadata — null until an admin acts
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [2000, 'adminNotes cannot exceed 2000 characters.'],
      default: null,
    },
    reportedMessageSnapshot: {
      content: { type: String, default: null },
      fileUrl: { type: String, default: null },
      fileName: { type: String, default: null },
      fileMimeType: { type: String, default: null },
      fileSizeBytes: { type: Number, default: null },
      type: { type: String, default: 'text' },
    },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Admin queue: filter by status, newest first
messageReportSchema.index({ status: 1, createdAt: -1 });
// Prevent duplicate reports: one reporter can report a given message only once
messageReportSchema.index({ message: 1, reporter: 1 }, { unique: true });
// Fast lookup of all reports against a specific user
messageReportSchema.index({ reportedUser: 1, status: 1 });

const MessageReport = mongoose.model('MessageReport', messageReportSchema);
module.exports = MessageReport;
