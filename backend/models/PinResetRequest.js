const mongoose = require('mongoose');

const pinResetRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'user is required.'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected', 'expired'],
        message: '{VALUE} is not a valid status.',
      },
      default: 'pending',
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    newPin: {
      type: String, // hashed
    },
    token: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PinResetRequest', pinResetRequestSchema);
