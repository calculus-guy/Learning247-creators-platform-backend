const sequelize = require('./config/db');

async function setupLiveSeriesFeature() {
  try {
    console.log('🚀 Starting Live Series Feature setup for production...\n');
    
    // Step 1: Create live_series table
    console.log('1️⃣ Creating live_series table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS live_series (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
        thumbnail_url VARCHAR(255),
        category VARCHAR(255),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        recurrence_pattern JSON NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
        privacy VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'private')),
        max_participants INTEGER DEFAULT 50,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ live_series table created\n');

    // Step 2: Create live_sessions table
    console.log('2️⃣ Creating live_sessions table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS live_sessions (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        series_id UUID NOT NULL REFERENCES live_series(id) ON UPDATE CASCADE ON DELETE CASCADE,
        session_number INTEGER NOT NULL,
        scheduled_start_time TIMESTAMP NOT NULL,
        scheduled_end_time TIMESTAMP NOT NULL,
        actual_start_time TIMESTAMP,
        actual_end_time TIMESTAMP,
        status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
        zego_room_id VARCHAR(255),
        zego_app_id VARCHAR(255),
        recording_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        CONSTRAINT unique_series_session_number UNIQUE (series_id, session_number)
      );
    `);
    console.log('✅ live_sessions table created\n');

    // Step 3: Add indexes for performance
    console.log('3️⃣ Creating indexes...');
    
    // live_series indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_live_series_user_id ON live_series(user_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_live_series_status ON live_series(status);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_live_series_dates ON live_series(start_date, end_date);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_live_series_category ON live_series(category);
    `);

    // live_sessions indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_live_sessions_series_id ON live_sessions(series_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_live_sessions_scheduled_start ON live_sessions(scheduled_start_time);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_live_sessions_session_number ON live_sessions(session_number);
    `);
    
    console.log('✅ All indexes created\n');

    // Step 4: Update purchases table to support live_series content type
    console.log('4️⃣ Updating purchases table for live_series support...');
    
    // Check if the enum already includes 'live_series'
    const [enumResult] = await sequelize.query(`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid 
        FROM pg_type 
        WHERE typname = 'enum_purchases_content_type'
      );
    `);
    
    const existingValues = enumResult.map(row => row.enumlabel);
    
    if (!existingValues.includes('live_series')) {
      // Add 'live_series' to the existing enum
      await sequelize.query(`
        ALTER TYPE enum_purchases_content_type ADD VALUE IF NOT EXISTS 'live_series';
      `);
      console.log('✅ Added "live_series" to purchases content_type enum\n');
    } else {
      console.log('✅ "live_series" already exists in purchases content_type enum\n');
    }

    // Step 5: Verify table creation
    console.log('5️⃣ Verifying table creation...');
    
    const [seriesCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'live_series' AND table_schema = 'public';
    `);
    
    const [sessionsCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'live_sessions' AND table_schema = 'public';
    `);

    console.log(`📊 Tables verification:`);
    console.log(`   - live_series: ${seriesCount[0].count > 0 ? '✅ Created' : '❌ Missing'}`);
    console.log(`   - live_sessions: ${sessionsCount[0].count > 0 ? '✅ Created' : '❌ Missing'}`);
    console.log('');

    // Step 6: Verify indexes
    console.log('6️⃣ Verifying indexes...');
    
    const [indexCount] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM pg_indexes 
      WHERE tablename IN ('live_series', 'live_sessions') 
      AND schemaname = 'public';
    `);
    
    console.log(`   - Total indexes created: ${indexCount[0].count}`);
    console.log('');

    // Step 7: Show next steps
    console.log('🎉 Live Series Feature setup completed successfully!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Restart your server: pm2 restart backend');
    console.log('   2. Test the series endpoints with the API documentation');
    console.log('   3. Review LIVE_SERIES_API_DOCUMENTATION.md for endpoint details');
    console.log('');
    console.log('📚 Available endpoints:');
    console.log('   Series Management:');
    console.log('   - POST /api/live/series/create');
    console.log('   - GET /api/live/series');
    console.log('   - GET /api/live/series/my-series');
    console.log('   - GET /api/live/series/:id');
    console.log('   - GET /api/live/series/:id/sessions');
    console.log('   - PUT /api/live/series/:id');
    console.log('   - DELETE /api/live/series/:id');
    console.log('');
    console.log('   Session Management:');
    console.log('   - POST /api/live/session/:id/start');
    console.log('   - POST /api/live/session/:id/end');
    console.log('   - POST /api/live/session/:id/join');
    console.log('   - GET /api/live/session/:id');
    console.log('   - GET /api/live/session/upcoming');
    console.log('');
    console.log('🔒 Safety Notes:');
    console.log('   - Existing live_classes table is UNTOUCHED');
    console.log('   - Existing one-time live classes still work normally');
    console.log('   - New series feature is completely separate');
    console.log('   - Cleanup service handles both independently');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up Live Series Feature:', error.message);
    console.error('\nFull error:', error);
    
    // Provide troubleshooting tips
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure PostgreSQL UUID extension is enabled:');
    console.log('      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('   2. Check if purchases table exists and has the required structure');
    console.log('   3. Verify Users table exists for foreign key references');
    console.log('   4. Check database connection and permissions');
    console.log('   5. If enum update fails, you may need to manually add the value:');
    console.log('      ALTER TYPE enum_purchases_content_type ADD VALUE \'live_series\';');
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

setupLiveSeriesFeature();
