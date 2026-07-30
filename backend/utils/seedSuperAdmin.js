const User = require('../models/User');

/**
 * Seeds a single Super Admin account from environment variables
 * if no superadmin document exists in the database.
 * Called once after MongoDB connects in server.js.
 */
async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      '[SEED] SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is not set. ' +
        'Super Admin account will NOT be seeded.'
    );
    return;
  }

  try {
    const existing = await User.findOne({ role: 'superadmin' });

    if (existing) {
      console.log('[SEED] Super Admin already exists — skipping seed.');
      return;
    }

    const superAdmin = new User({
      name: 'Super Admin',
      email: email.trim().toLowerCase(),
      password, // will be hashed by the pre-save hook
      role: 'superadmin',
      status: 'approved', // Super Admin is pre-approved
    });

    await superAdmin.save();
    console.log(`[SEED] Super Admin account created for ${email}.`);
  } catch (err) {
    console.error('[SEED] Failed to seed Super Admin:', err.message);
  }
}

module.exports = seedSuperAdmin;
