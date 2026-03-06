const sequelize = require('./config/db');

/**
 * Production Setup Script for Referral System
 * 
 * Run this script on production server after SSH:
 * node setup-referral-system.js
 * 
 * This script will:
 * 1. Create referral_codes table
 * 2. Create referral_commissions table
 * 3. Create indexes for performance
 * 4. Verify setup
 */

async function setupReferralSystem() {
  try {
    console.log('🚀 Starting Referral System setup for production...\n');
    
    // Enable UUID extension if not already enabled
    console.log('0️⃣ Enabling UUID extension...');
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('✅ UUID extension enabled\n');

    // Step 1: Create referral_codes table
    console.log('1️⃣ Creating referral_codes table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        referral_code VARCHAR(20) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        series_id UUID NOT NULL,
        clicks_count INTEGER DEFAULT 0 NOT NULL,
        successful_referrals INTEGER DEFAULT 0 NOT NULL,
        total_earnings DECIMAL(10,2) DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        last_used_at TIMESTAMP
      );
    `);
    console.log('✅ referral_codes table created\n');

    // Step 2: Create referral_commissions table
    console.log('2️⃣ Creating referral_commissions table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS referral_commissions (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        referral_code VARCHAR(20) NOT NULL,
        referrer_user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        referee_user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        purchase_id UUID NOT NULL REFERENCES purchases(id) ON UPDATE CASCADE ON DELETE CASCADE,
        series_id UUID NOT NULL,
        coupon_code VARCHAR(50) NOT NULL,
        commission_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
        purchased_at TIMESTAMP NOT NULL,
        approved_by INTEGER REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE SET NULL,
        approved_at TIMESTAMP,
        paid_at TIMESTAMP,
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ referral_commissions table created\n');

    // Step 3: Create indexes for performance
    console.log('3️⃣ Creating indexes...');
    
    // Referral codes indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(referral_code);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_codes_series_id ON referral_codes(series_id);
    `);
    
    // Referral commissions indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer ON referral_commissions(referrer_user_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_commissions_referee ON referral_commissions(referee_user_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_commissions_status ON referral_commissions(status);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_commissions_purchase ON referral_commissions(purchase_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_referral_commissions_code ON referral_commissions(referral_code);
    `);
    
    console.log('✅ All indexes created\n');

    // Step 4: Verify table creation
    console.log('4️⃣ Verifying table creation...');
    
    const [codesCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'referral_codes' AND table_schema = 'public';
    `);
    
    const [commissionsCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'referral_commissions' AND table_schema = 'public';
    `);
    
    console.log(`📊 Tables verification:`);
    console.log(`   - referral_codes: ${codesCount[0].count > 0 ? '✅ Created' : '❌ Missing'}`);
    console.log(`   - referral_commissions: ${commissionsCount[0].count > 0 ? '✅ Created' : '❌ Missing'}`);
    console.log('');

    // Step 5: Verify indexes
    console.log('5️⃣ Verifying indexes...');
    
    const [codesIndexCount] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM pg_indexes 
      WHERE tablename = 'referral_codes' 
      AND schemaname = 'public';
    `);
    
    const [commissionsIndexCount] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM pg_indexes 
      WHERE tablename = 'referral_commissions' 
      AND schemaname = 'public';
    `);
    
    console.log(`   - referral_codes indexes: ${codesIndexCount[0].count}`);
    console.log(`   - referral_commissions indexes: ${commissionsIndexCount[0].count}`);
    console.log('');

    // Step 6: Check current data
    console.log('6️⃣ Checking current data...');
    
    const [codesData] = await sequelize.query(`
      SELECT COUNT(*) as count FROM referral_codes;
    `);
    
    const [commissionsData] = await sequelize.query(`
      SELECT COUNT(*) as count FROM referral_commissions;
    `);
    
    console.log(`   - Total referral codes: ${codesData[0].count}`);
    console.log(`   - Total commissions: ${commissionsData[0].count}`);
    console.log('');

    // Step 7: Show next steps
    console.log('🎉 Referral System setup completed successfully!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Restart your server: pm2 restart backend');
    console.log('   2. Test the referral endpoints');
    console.log('   3. Review REFERRAL_API_DOCS.md for endpoint details');
    console.log('');
    console.log('📚 Available endpoints:');
    console.log('   User Endpoints:');
    console.log('   - POST /api/referral/generate-link - Generate referral link');
    console.log('   - POST /api/referral/track-click - Track clicks');
    console.log('   - GET /api/referral/my-stats - View stats');
    console.log('   - GET /api/referral/my-earnings - View earnings');
    console.log('');
    console.log('   Admin Endpoints:');
    console.log('   - GET /api/referral/admin/commissions - View all commissions');
    console.log('   - GET /api/referral/admin/commissions/stats - View statistics');
    console.log('   - PATCH /api/referral/admin/commissions/:id/approve - Approve & pay');
    console.log('   - PATCH /api/referral/admin/commissions/:id/reject - Reject');
    console.log('');
    console.log('💰 Referral Program Details:');
    console.log('   - Series: Digital Marketing Masterclass');
    console.log('   - Coupon: SAVEBIG10');
    console.log('   - Commission: ₦2,500 per referral');
    console.log('   - Split: 50/50 (Company ₦2,500 | Referrer ₦2,500)');
    console.log('   - Approval: Manual by admin');
    console.log('');
    console.log('🔒 Safety Notes:');
    console.log('   - Existing tables are UNTOUCHED');
    console.log('   - Script uses "IF NOT EXISTS" to prevent errors');
    console.log('   - Safe to run multiple times');
    console.log('   - All changes are additive (no data loss)');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up Referral System:', error.message);
    console.error('\nFull error:', error);
    
    // Provide troubleshooting tips
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure PostgreSQL UUID extension is enabled:');
    console.log('      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('   2. Check if Users table exists');
    console.log('   3. Check if purchases table exists');
    console.log('   4. Verify database connection and permissions');
    console.log('   5. Check if tables already exist');
    console.log('');
    console.log('💡 Note: If tables already exist, this is safe to run again.');
    console.log('   The script uses "IF NOT EXISTS" to prevent errors.');
    
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

setupReferralSystem();
