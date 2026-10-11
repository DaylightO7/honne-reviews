const mongoose = require('mongoose');
const User = require('../models/User');

// Automatic seeder for Master Administrator
const seedMasterAdmin = async () => {
  try {
    const existingMaster = await User.findOne({ email: 'masteradmin@gmail.com' });
    if (!existingMaster) {
      await User.create({
        name: 'Master Administrator',
        email: 'masteradmin@gmail.com',
        password: 'masteradmin123',
        role: 'master_admin'
      });
      console.log('[Security] Master Admin auto-seeded: masteradmin@gmail.com');
    }
  } catch (err) {
    console.error('[Security] Error auto-seeding Master Admin:', err.message);
  }
};

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/web_review_hub';
    const conn = await mongoose.connect(mongoURI);

    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);

    // Run master admin seeder
    await seedMasterAdmin();
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected from database');
});

module.exports = connectDB;
