const sequelize = require('./config/db');

/**
 * Production Setup Script for Session Recording System
 * 
 * Run this script on production server after SSH:
 * node setup-session-recording.js
 * 
 * This script will:
 * 1. Create session_recording_sends table
 * 2. Create indexes for performance
 * 3. Verify setup
 */

async function setupSessionRecordingSystem() {
  try {
    console.log('🚀 Starting Session Recording System setup for production...\n');
    
    // Enable UUID extension if not already enabled
    console.log('0️⃣ Enabling UUID extension...');
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('✅ UUID extension enabled\n');

    // Step 1: Create session_recording_sends table
    console.log('1️⃣ Creating session_recording_sends table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS session_recording_sends (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        series_id UUID NOT NULL REFERENCES live_series(id) ON UPDATE CASCADE ON DELETE CASCADE,
        session_number INTEGER NOT NULL,
        user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        drive_link TEXT NOT NULL,
        send_batch_id UUID NOT NULL,
        sent_at TIMESTAMP DEFAULT NOW() NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ session_recording_sends table created\n');

    // Step 2: Create indexes for performance
    console.log('2️⃣ Creating indexes...');
    
    // Index for checking if user already received recording for a session
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_recording_sends_unique_check 
      ON session_recording_sends(series_id, session_number, user_id);
    `);
    
    // Index for batch tracking
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_recording_sends_batch 
      ON session_recording_sends(send_batch_id);
    `);
    
    // Index for series lookup
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_recording_sends_series 
      ON session_recording_sends(series_id);
    `);
    
    // Index for user lookup
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_recording_sends_user 
      ON session_recording_sends(user_id);
    `);
    
    console.log('✅ All indexes created\n');

    // Step 3: Verify table creation
    console.log('3️⃣ Verifying table creation...');
    
    const [tableCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'session_recording_sends' AND table_schema = 'public';
    `);
    
    console.log(`📊 Table verification:`);
    console.log(`   - session_recording_sends: ${tableCount[0].count > 0 ? '✅ Created' : '❌ Missing'}`);
    console.log('');

    // Step 4: Verify indexes
    console.log('4️⃣ Verifying indexes...');
    
    const [indexCount] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM pg_indexes 
      WHERE tablename = 'session_recording_sends' 
      AND schemaname = 'public';
    `);
    
    console.log(`   - session_recording_sends indexes: ${indexCount[0].count}`);
    console.log('');

    // Step 5: Check current data
    console.log('5️⃣ Checking current data...');
    
    const [recordsData] = await sequelize.query(`
      SELECT COUNT(*) as count FROM session_recording_sends;
    `);
    
    console.log(`   - Total recording sends: ${recordsData[0].count}`);
    console.log('');

    // Step 6: Show next steps
    console.log('🎉 Session Recording System setup completed successfully!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Restart your server: pm2 restart backend');
    console.log('   2. Test the recording endpoints');
    console.log('   3. Review SESSION_RECORDING_API_DOCS.md for endpoint details');
    console.log('');
    console.log('📚 Available endpoints:');
    console.log('   Admin Endpoints:');
    console.log('   - POST /api/admin/live-series/:seriesId/send-recording/test');
    console.log('     Send test email to verify template');
    console.log('');
    console.log('   - POST /api/admin/live-series/:seriesId/send-recording');
    console.log('     Send recordings to all enrolled students');
    console.log('');
    console.log('   - GET /api/admin/live-series/:seriesId/recording-history');
    console.log('     View send history for a series');
    console.log('');
    console.log('📝 Example Usage (Capcut Series):');
    console.log('   Series ID: f0e13348-6550-46df-88a0-66905d72a913');
    console.log('');
    console.log('   1. Test first:');
    console.log('      POST /api/admin/live-series/f0e13348-6550-46df-88a0-66905d72a913/send-recording/test');
    console.log('      Body: {');
    console.log('        "recordings": [');
    console.log('          {"sessionNumber": 1, "driveLink": "https://drive.google.com/..."},');
    console.log('          {"sessionNumber": 2, "driveLink": "https://drive.google.com/..."}');
    console.log('        ],');
    console.log('        "customMessage": "Great work!",');
    console.log('        "testEmail": "your@email.com"');
    console.log('      }');
    console.log('');
    console.log('   2. Send to all students:');
    console.log('      POST /api/admin/live-series/f0e13348-6550-46df-88a0-66905d72a913/send-recording');
    console.log('      Body: {');
    console.log('        "recordings": [');
    console.log('          {"sessionNumber": 1, "driveLink": "https://drive.google.com/..."},');
    console.log('          {"sessionNumber": 2, "driveLink": "https://drive.google.com/..."}');
    console.log('        ],');
    console.log('        "customMessage": "Great work!"');
    console.log('      }');
    console.log('');
    console.log('✨ Key Features:');
    console.log('   - Duplicate Prevention: Tracks who received what');
    console.log('   - Retry Safe: Can retry failed sends without spamming');
    console.log('   - Multiple Sessions: Send multiple recordings in one email');
    console.log('   - Scalable: Handles thousands of students');
    console.log('   - Test First: Preview email before sending to all');
    console.log('');
    console.log('🔒 Safety Notes:');
    console.log('   - Existing tables are UNTOUCHED');
    console.log('   - Script uses "IF NOT EXISTS" to prevent errors');
    console.log('   - Safe to run multiple times');
    console.log('   - All changes are additive (no data loss)');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up Session Recording System:', error.message);
    console.error('\nFull error:', error);
    
    // Provide troubleshooting tips
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure PostgreSQL UUID extension is enabled:');
    console.log('      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('   2. Check if Users table exists');
    console.log('   3. Check if live_series table exists');
    console.log('   4. Verify database connection and permissions');
    console.log('   5. Check if table already exists');
    console.log('');
    console.log('💡 Note: If table already exists, this is safe to run again.');
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

setupSessionRecordingSystem();
