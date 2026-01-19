const sequelize = require('./config/db');

async function fixWithdrawal2FA() {
  try {
    console.log('🔧 Starting withdrawal 2FA database fix...\n');
    
    // Check if withdrawal_otps table exists
    console.log('1️⃣ Checking if withdrawal_otps table exists...');
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'withdrawal_otps';
    `);
    
    if (tables.length === 0) {
      console.log('📋 Creating withdrawal_otps table...');
      
      // Create the withdrawal_otps table
      await sequelize.query(`
        CREATE TABLE withdrawal_otps (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "withdrawalId" VARCHAR(255) NOT NULL UNIQUE,
          "userId" INTEGER NOT NULL,
          code VARCHAR(6) NOT NULL,
          amount DECIMAL(15,2) NOT NULL,
          currency VARCHAR(3) NOT NULL,
          "bankAccount" JSONB NOT NULL,
          reference VARCHAR(255) NOT NULL,
          attempts INTEGER DEFAULT 0,
          "maxAttempts" INTEGER DEFAULT 3,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'failed')),
          "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          "verifiedAt" TIMESTAMP WITH TIME ZONE,
          "lastResendAt" TIMESTAMP WITH TIME ZONE,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `);
      console.log('✅ withdrawal_otps table created\n');
      
      // Create indexes
      console.log('2️⃣ Creating indexes...');
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_otps_withdrawal_id_unique 
        ON withdrawal_otps("withdrawalId");
      `);
      
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS withdrawal_otps_user_id_index 
        ON withdrawal_otps("userId");
      `);
      
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS withdrawal_otps_status_index 
        ON withdrawal_otps(status);
      `);
      
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS withdrawal_otps_expires_at_index 
        ON withdrawal_otps("expiresAt");
      `);
      console.log('✅ Indexes created\n');
      
    } else {
      console.log('✅ withdrawal_otps table already exists\n');
    }
    
    // Clean up any expired OTPs from previous runs
    console.log('3️⃣ Cleaning up expired OTPs...');
    const [cleanupResult] = await sequelize.query(`
      UPDATE withdrawal_otps 
      SET status = 'expired' 
      WHERE status = 'pending' 
      AND "expiresAt" < NOW()
      RETURNING id;
    `);
    console.log(`✅ Cleaned up ${cleanupResult.length} expired OTPs\n`);
    
    // Verify table structure
    console.log('4️⃣ Verifying table structure...');
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'withdrawal_otps' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📊 Table structure:');
    columns.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    console.log('');
    
    // Test database connection and model
    console.log('5️⃣ Testing database connection...');
    const WithdrawalOTP = require('./models/WithdrawalOTP');
    
    // Count existing records
    const totalRecords = await WithdrawalOTP.count();
    const activeRecords = await WithdrawalOTP.count({
      where: {
        status: 'pending',
        expiresAt: {
          [require('sequelize').Op.gt]: new Date()
        }
      }
    });
    
    console.log(`✅ Database connection successful`);
    console.log(`📈 Total OTP records: ${totalRecords}`);
    console.log(`🔄 Active OTP records: ${activeRecords}\n`);
    
    console.log('🎉 All done! Withdrawal 2FA is now using persistent database storage.');
    console.log('✨ Benefits:');
    console.log('   - OTPs survive server restarts');
    console.log('   - Better debugging and monitoring');
    console.log('   - Automatic cleanup of expired OTPs');
    console.log('   - Production-ready persistence\n');
    
    console.log('🚀 You can now restart your server: pm2 restart backend\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
    console.error('\n🔍 Troubleshooting:');
    console.error('   1. Make sure PostgreSQL is running');
    console.error('   2. Check database connection in .env file');
    console.error('   3. Ensure database user has CREATE TABLE permissions');
    console.error('   4. Try running: npm install sequelize pg pg-hstore\n');
    process.exit(1);
  }
}

fixWithdrawal2FA();