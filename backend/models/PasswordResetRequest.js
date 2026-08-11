const mongoose = require('mongoose');

const passwordResetRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'user is required.'],
    },
    // Either 'password' (admins/superadmins) or 'pin' (teachers/students)
    type: {
      type: String,
      enum: {
        values: ['password', 'pin'],
        message: '{VALUE} is not a valid reset type.',
      },
      required: [true, 'reset type is required.'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'resolved', 'rejected'],
        message: '{VALUE} is not a valid status.',
      },
      default: 'pending',
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
    },
    tempCredential: {
      type: String, // The generated credential shown to the admin to give the user
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PasswordResetRequest', passwordResetRequestSchema);
