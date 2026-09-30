const path = require('node:path');
const rootEnvPath = path.resolve(__dirname, '..', '..', '.env');
require('dotenv').config({ path: rootEnvPath });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function createAdmin() {
  const { MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  const missing = [
    ['MONGODB_URI', MONGODB_URI],
    ['ADMIN_NAME', ADMIN_NAME],
    ['ADMIN_EMAIL', ADMIN_EMAIL],
    ['ADMIN_PASSWORD', ADMIN_PASSWORD],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}.`);
  if (ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');

  await mongoose.connect(MONGODB_URI);
  const email = ADMIN_EMAIL.toLowerCase().trim();
  const user = await User.findOneAndUpdate(
    { email },
    { name: ADMIN_NAME, email, password: await bcrypt.hash(ADMIN_PASSWORD, 12), role: 'admin' },
    { upsert: true, new: true, runValidators: true }
  );
  console.log(`Administrator ${user.isNew ? 'created' : 'created or updated'}: ${user.email}`);
  await mongoose.disconnect();
}

createAdmin().catch(async (error) => {
  const message = error.message.replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[REDACTED_MONGODB_URI]');
  console.error(message);
  await mongoose.disconnect();
  process.exit(1);
});