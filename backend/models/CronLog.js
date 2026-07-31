const mongoose = require('mongoose');

/**
 * CronLog — Audit trail model tracking every execution of scheduled cron jobs.
 */
const cronLogSchema = new mongoose.Schema(
  {
    jobName: {
      type: String,
      default: 'daily_db_cleanup',
      required: true,
    },
    executedAt: {
      type: Date,
      default: Date.now,
    },
    initialDbSizeMb: {
      type: Number,
      required: true,
    },
    resultingDbSizeMb: {
      type: Number,
      default: null,
    },
    actionTaken: {
      type: String,
      enum: {
        values: ['none', 'deleted_messages', 'superadmin_alert_sent'],
        message: 'actionTaken must be one of: none, deleted_messages, superadmin_alert_sent.',
      },
      required: true,
    },
    deletedMessageCount: {
      type: Number,
      default: 0,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

cronLogSchema.index({ jobName: 1, executedAt: -1 });

const CronLog = mongoose.model('CronLog', cronLogSchema);
module.exports = CronLog;
