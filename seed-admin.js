/**
 * Seed Admin User Script
 * 
 * Creates an admin user in the database
 * Run with: node seed-admin.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const sequelize = require('./config/db');

async function seedAdmin() {
  try {
    console.log('🌱 Starting admin user seed...\n');

    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Admin credentials
    const adminEmail = 'admin@hallos.com';
    const adminPassword = 'admin2026';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ where: { email: adminEmail } });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Role: ${existingAdmin.role}`);
      console.log(`   ID: ${existingAdmin.id}\n`);
      
      // Update to admin role if not already
      if (existingAdmin.role !== 'admin') {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log('✅ Updated existing user to admin role\n');
      }
      
      process.exit(0);
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    console.log('✅ Password hashed\n');

    // Create admin user
    console.log('👤 Creating admin user...');
    const admin = await User.create({
      firstname: 'Admin',
      lastname: 'Hallos',
      email: adminEmail,
      password: hashedPassword,
      role: 'admin'
    });

    console.log('✅ Admin user created successfully!\n');
    console.log('📋 Admin Details:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role:     ${admin.role}`);
    console.log(`   ID:       ${admin.id}`);
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎉 Admin can now login to the platform!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

seedAdmin();
