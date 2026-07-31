require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/classbridge';

async function runMigration() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  console.log('Unsetting explicit null values for phone and email in User documents...');
  const result = await User.updateMany(
    { $or: [{ phone: null }, { email: null }] },
    { $unset: { phone: '', email: '' } }
  );

  console.log(`Migration completed. Matched and updated ${result.modifiedCount} user documents.`);
  await mongoose.connection.close();
  console.log('Connection closed.');
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
