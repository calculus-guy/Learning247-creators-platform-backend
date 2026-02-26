const sequelize = require('./config/db');

async function setupNotificationSystem() {
  try {
    console.log('🚀 Starting Notification System setup for production...\n');
    
    // Step 1: Add profile fields to Users table
    console.log('1️⃣ Adding profile fields to Users table...');
    
    // Check if columns already exist
    const [phoneCheck] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Users' AND column_name = 'phone_number';
    `);
    
    if (phoneCheck.length === 0) {
      await sequelize.query(`
        ALTER TABLE "Users" ADD COLUMN phone_number VARCHAR(20);
      `);
      console.log('   ✅ Added phone_number column');
    } else {
      console.log('   ✅ phone_number column already exists');
    }

    const [countryCheck] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Users' AND column_name = 'country';
    `);
    
    if (countryCheck.length === 0) {
      await sequelize.query(`
        ALTER TABLE "Users" ADD COLUMN country VARCHAR(100);
      `);
      console.log('   ✅ Added country column');
    } else {
      console.log('   ✅ country column already exists');
    }

    const [bioCheck] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Users' AND column_name = 'bio';
    `);
    
    if (bioCheck.length === 0) {
      await sequelize.query(`
        ALTER TABLE "Users" ADD COLUMN bio TEXT;
      `);
      console.log('   ✅ Added bio column');
    } else {
      console.log('   ✅ bio column already exists');
    }

    const [socialCheck] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Users' AND column_name = 'social_links';
    `);
    
    if (socialCheck.length === 0) {
      await sequelize.query(`
        ALTER TABLE "Users" ADD COLUMN social_links JSONB DEFAULT '{}';
      `);
      console.log('   ✅ Added social_links column');
    } else {
      console.log('   ✅ social_links column already exists');
    }

    const [newsletterCheck] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Users' AND column_name = 'newsletter_subscribed';
    `);
    
    if (newsletterCheck.length === 0) {
      await sequelize.query(`
        ALTER TABLE "Users" ADD COLUMN newsletter_subscribed BOOLEAN NOT NULL DEFAULT false;
      `);
      console.log('   ✅ Added newsletter_subscribed column');
    } else {
      console.log('   ✅ newsletter_subscribed column already exists');
    }

    console.log('✅ Users table updated\n');

    // Step 2: Add reminder_sent field to live_sessions table
    console.log('2️⃣ Adding reminder_sent field to live_sessions table...');
    
    const [reminderCheck] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'live_sessions' AND column_name = 'reminder_sent';
    `);
    
    if (reminderCheck.length === 0) {
      await sequelize.query(`
        ALTER TABLE live_sessions ADD COLUMN reminder_sent BOOLEAN NOT NULL DEFAULT false;
      `);
      console.log('   ✅ Added reminder_sent column');
    } else {
      console.log('   ✅ reminder_sent column already exists');
    }

    console.log('✅ live_sessions table updated\n');

    // Step 3: Create indexes for performance
    console.log('3️⃣ Creating indexes...');
    
    // Users newsletter index
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_users_newsletter_subscribed ON "Users"(newsletter_subscribed);
    `);
    console.log('   ✅ Created idx_users_newsletter_subscribed');

    // Live sessions reminder index
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_live_sessions_reminder_scheduled 
      ON live_sessions(reminder_sent, scheduled_start_time);
    `);
    console.log('   ✅ Created idx_live_sessions_reminder_scheduled');
    
    console.log('✅ All indexes created\n');

    // Step 4: Verify columns
    console.log('4️⃣ Verifying column creation...');
    
    const [userColumns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Users' 
      AND column_name IN ('phone_number', 'country', 'bio', 'social_links', 'newsletter_subscribed');
    `);
    
    const [sessionColumns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'live_sessions' 
      AND column_name = 'reminder_sent';
    `);

    console.log(`📊 Columns verification:`);
    console.log(`   - Users table: ${userColumns.length}/5 columns added`);
    console.log(`   - live_sessions table: ${sessionColumns.length}/1 columns added`);
    console.log('');

    // Step 5: Verify indexes
    console.log('5️⃣ Verifying indexes...');
    
    const [indexCount] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM pg_indexes 
      WHERE indexname IN ('idx_users_newsletter_subscribed', 'idx_live_sessions_reminder_scheduled')
      AND schemaname = 'public';
    `);
    
    console.log(`   - Notification indexes created: ${indexCount[0].count}/2`);
    console.log('');

    // Step 6: Show next steps
    console.log('🎉 Notification System setup completed successfully!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Ensure .env has: NOTIFICATIONS_ENABLED=true');
    console.log('   2. Restart your server: pm2 restart backend');
    console.log('   3. Email scheduler will start automatically');
    console.log('   4. Test profile endpoints');
    console.log('');
    console.log('📚 Available endpoints:');
    console.log('   Profile Management:');
    console.log('   - GET /api/profile');
    console.log('   - PATCH /api/profile');
    console.log('   - POST /api/profile/picture');
    console.log('   - POST /api/profile/change-password');
    console.log('   - GET /api/profile/notifications');
    console.log('   - PATCH /api/profile/notifications');
    console.log('');
    console.log('📧 Email Notifications:');
    console.log('   - Session reminders: Sent 1 hour before (automatic)');
    console.log('   - Newsletter: Sent when new content uploaded (opt-in)');
    console.log('   - Cron job: Runs every 15 minutes');
    console.log('');
    console.log('🔧 Configuration:');
    console.log('   - NOTIFICATIONS_ENABLED=true  (production)');
    console.log('   - NOTIFICATIONS_ENABLED=false (testing)');
    console.log('');
    console.log('🔒 Safety Notes:');
    console.log('   - All new fields have default values');
    console.log('   - Existing functionality is UNTOUCHED');
    console.log('   - Can be disabled via .env');
    console.log('   - No breaking changes');
    console.log('');
    console.log('📖 Documentation:');
    console.log('   - See NOTIFICATION_SYSTEM_DOCS.md for full details');
    console.log('   - See FRONTEND_CURRENCY_API_DOCS.md for currency changes');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up Notification System:', error.message);
    console.error('\nFull error:', error);
    
    // Provide troubleshooting tips
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure Users table exists');
    console.log('   2. Ensure live_sessions table exists');
    console.log('   3. Check database connection and permissions');
    console.log('   4. Verify PostgreSQL version supports JSONB');
    console.log('   5. Check if columns already exist (safe to run again)');
    console.log('');
    console.log('💡 Note: This script is idempotent - safe to run multiple times.');
    console.log('   It checks for existing columns before adding them.');
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Setup interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Setup terminated');
  process.exit(1);
});

setupNotificationSystem();
