const cron = require('node-cron');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const CronLog = require('../models/CronLog');
const { sendExpoPushNotifications } = require('../utils/pushNotifications');

const DB_SIZE_LIMIT_MB = 480;
const MIN_AGE_MONTHS = 5;

/**
 * Get current MongoDB storage size in Megabytes.
 */
async function getDbSizeMb() {
  try {
    const stats = await mongoose.connection.db.stats();
    // dataSize or storageSize in bytes converted to MB
    const bytes = stats.dataSize || stats.storageSize || 0;
    return bytes / (1024 * 1024);
  } catch (err) {
    console.error('[CRON] Error getting DB stats:', err.message);
    return 0;
  }
}

/**
 * Calculate difference in calendar months between date and now.
 */
function getAgeInMonths(date) {
  const now = new Date();
  const d = new Date(date);
  let months = (now.getFullYear() - d.getFullYear()) * 12;
  months -= d.getMonth();
  months += now.getMonth();
  return months <= 0 ? 0 : months;
}

/**
 * Core daily database cleanup task.
 */
async function runDailyCleanupJob() {
  console.log('[CRON] Running daily database cleanup check...');
  const initialDbSizeMb = await getDbSizeMb();
  console.log(`[CRON] Current DB size: ${initialDbSizeMb.toFixed(2)} MB (Threshold: ${DB_SIZE_LIMIT_MB} MB)`);

  if (initialDbSizeMb < DB_SIZE_LIMIT_MB) {
    console.log('[CRON] DB size is below threshold. No cleanup needed.');
    await CronLog.create({
      jobName: 'daily_db_cleanup',
      executedAt: new Date(),
      initialDbSizeMb,
      resultingDbSizeMb: initialDbSizeMb,
      actionTaken: 'none',
      deletedMessageCount: 0,
      details: { note: 'DB size is below 480 MB limit.' },
    });
    return;
  }

  // Find oldest non-reported message in DB
  const oldestMessage = await Message.findOne({ isReported: false })
    .sort({ createdAt: 1 })
    .select('createdAt');

  if (!oldestMessage) {
    console.log('[CRON] No non-reported messages found in database.');
    await CronLog.create({
      jobName: 'daily_db_cleanup',
      executedAt: new Date(),
      initialDbSizeMb,
      resultingDbSizeMb: initialDbSizeMb,
      actionTaken: 'none',
      deletedMessageCount: 0,
      details: { note: 'No non-reported messages exist in DB.' },
    });
    return;
  }

  const oldestAgeMonths = getAgeInMonths(oldestMessage.createdAt);
  console.log(`[CRON] Oldest message date: ${oldestMessage.createdAt.toISOString()} (${oldestAgeMonths} months old)`);

  if (oldestAgeMonths < MIN_AGE_MONTHS) {
    console.warn('[CRON] DB size >= 480 MB but oldest message is < 5 months old. Aborting auto-delete and alerting Super Admins.');

    // Query all Super Admins
    const superAdmins = await User.find({ role: 'superadmin', expoPushToken: { $ne: null } }).select('expoPushToken');

    if (superAdmins.length > 0) {
      const alertPayloads = superAdmins.map((admin) => ({
        to: admin.expoPushToken,
        title: 'ClassBridge Database Capacity Warning',
        body: `Database size is ${initialDbSizeMb.toFixed(1)} MB (near capacity), but oldest message is under 5 months old. Manual review is required.`,
        data: { type: 'db_capacity_warning' },
      }));
      await sendExpoPushNotifications(alertPayloads);
    }

    await CronLog.create({
      jobName: 'daily_db_cleanup',
      executedAt: new Date(),
      initialDbSizeMb,
      resultingDbSizeMb: initialDbSizeMb,
      actionTaken: 'superadmin_alert_sent',
      deletedMessageCount: 0,
      details: {
        note: 'Oldest message is younger than 5 months. Alert sent to superadmins.',
        oldestMessageDate: oldestMessage.createdAt,
        oldestAgeMonths,
      },
    });
    return;
  }

  // Proceed with 1-month chunk deletion logic until DB < 480 MB or no eligible old months remain
  let currentDbSizeMb = initialDbSizeMb;
  let totalDeletedCount = 0;
  let currentOldestDate = new Date(oldestMessage.createdAt);

  while (currentDbSizeMb >= DB_SIZE_LIMIT_MB) {
    const currentAgeMonths = getAgeInMonths(currentOldestDate);
    if (currentAgeMonths < MIN_AGE_MONTHS) {
      console.log('[CRON] Reached messages younger than 5 months. Stopping deletion loop.');
      break;
    }

    // Define 1-month window: [currentOldestDate, 1 month later)
    const windowStart = new Date(currentOldestDate.getFullYear(), currentOldestDate.getMonth(), 1);
    const windowEnd = new Date(currentOldestDate.getFullYear(), currentOldestDate.getMonth() + 1, 1);

    console.log(`[CRON] Processing deletion window: ${windowStart.toISOString().split('T')[0]} to ${windowEnd.toISOString().split('T')[0]}`);

    // Aggregate IDs of top 50 newest messages per conversation to exclude them from deletion
    const top50PerConv = await Message.aggregate([
      { $sort: { conversation: 1, createdAt: -1 } },
      {
        $group: {
          _id: '$conversation',
          messageIds: { $push: '$_id' },
        },
      },
      {
        $project: {
          top50: { $slice: ['$messageIds', 50] },
        },
      },
    ]);

    const top50MessageIds = top50PerConv.flatMap((item) => item.top50);

    // Delete messages in month window that are NOT reported and NOT in top 50 per conversation
    const deleteResult = await Message.deleteMany({
      createdAt: { $gte: windowStart, $lt: windowEnd },
      isReported: false,
      _id: { $nin: top50MessageIds },
    });

    const deletedInChunk = deleteResult.deletedCount || 0;
    totalDeletedCount += deletedInChunk;
    console.log(`[CRON] Deleted ${deletedInChunk} messages from window.`);

    if (deletedInChunk === 0) {
      // Advance to next month if no deletable messages in current month window
      currentOldestDate.setMonth(currentOldestDate.getMonth() + 1);
    }

    currentDbSizeMb = await getDbSizeMb();
    console.log(`[CRON] Updated DB size: ${currentDbSizeMb.toFixed(2)} MB`);

    // Safety check if no further progress can be made
    const nextOldest = await Message.findOne({ isReported: false })
      .sort({ createdAt: 1 })
      .select('createdAt');

    if (!nextOldest) break;
    currentOldestDate = new Date(nextOldest.createdAt);
  }

  const finalDbSizeMb = await getDbSizeMb();

  await CronLog.create({
    jobName: 'daily_db_cleanup',
    executedAt: new Date(),
    initialDbSizeMb,
    resultingDbSizeMb: finalDbSizeMb,
    actionTaken: 'deleted_messages',
    deletedMessageCount: totalDeletedCount,
    details: {
      initialDbSizeMb,
      finalDbSizeMb,
      totalDeletedCount,
    },
  });

  console.log(`[CRON] Cleanup job complete. Deleted ${totalDeletedCount} messages. Final DB size: ${finalDbSizeMb.toFixed(2)} MB.`);
}

/**
 * Initialize daily 2:00 AM cron schedule.
 */
function initCleanupCron() {
  // 0 2 * * * = Every day at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      await runDailyCleanupJob();
    } catch (err) {
      console.error('[CRON] Error during daily cleanup execution:', err);
    }
  });

  console.log('[CRON] Daily cleanup cron job scheduled for 2:00 AM.');
}

module.exports = {
  initCleanupCron,
  runDailyCleanupJob,
};
