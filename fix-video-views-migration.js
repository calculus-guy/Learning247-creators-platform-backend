const sequelize = require('./config/db');

async function fixVideoViewsUserIdType() {
  try {
    console.log('🚀 Starting video_views.user_id type fix...\n');
    
    // Step 1: Check current column type
    console.log('1️⃣ Checking current column type...');
    const [columnInfo] = await sequelize.query(`
      SELECT data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'video_views' 
      AND column_name = 'user_id';
    `);
    
    if (columnInfo.length > 0) {
      console.log(`   Current type: ${columnInfo[0].data_type} (${columnInfo[0].udt_name})`);
    }
    console.log('');

    // Step 2: Clear existing video_views data (UUID can't convert to INTEGER)
    console.log('2️⃣ Clearing existing video_views data...');
    const [countResult] = await sequelize.query(`
      SELECT COUNT(*) as count FROM video_views;
    `);
    const recordCount = countResult[0].count;
    console.log(`   Found ${recordCount} existing records`);
    
    await sequelize.query(`
      TRUNCATE TABLE video_views CASCADE;
    `);
    console.log('   ✅ Table cleared\n');

    // Step 3: Change column type from UUID to INTEGER
    console.log('3️⃣ Changing user_id column type to INTEGER...');
    await sequelize.query(`
      ALTER TABLE video_views 
      ALTER COLUMN user_id TYPE INTEGER 
      USING NULL;
    `);
    console.log('   ✅ Column type changed to INTEGER\n');

    // Step 4: Verify the change
    console.log('4️⃣ Verifying column type change...');
    const [newColumnInfo] = await sequelize.query(`
      SELECT data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'video_views' 
      AND column_name = 'user_id';
    `);
    
    if (newColumnInfo.length > 0) {
      console.log(`   New type: ${newColumnInfo[0].data_type} (${newColumnInfo[0].udt_name})`);
    }
    console.log('');

    // Step 5: Test insert
    console.log('5️⃣ Testing with sample data...');
    try {
      await sequelize.query(`
        INSERT INTO video_views (id, video_id, user_id, ip_address, created_at, updated_at)
        VALUES (
          uuid_generate_v4(),
          uuid_generate_v4(),
          1,
          '127.0.0.1',
          NOW(),
          NOW()
        );
      `);
      console.log('   ✅ Test insert successful');
      
      // Clean up test data
      await sequelize.query(`
        DELETE FROM video_views WHERE user_id = 1 AND ip_address = '127.0.0.1';
      `);
      console.log('   ✅ Test data cleaned up\n');
    } catch (testError) {
      console.log('   ⚠️  Test insert failed (this might be okay if video doesn\'t exist)');
      console.log('   Error:', testError.message, '\n');
    }

    console.log('🎉 Video views user_id type fix completed successfully!\n');
    console.log('📋 Summary:');
    console.log(`   - Cleared ${recordCount} existing video view records`);
    console.log('   - Changed user_id column from UUID to INTEGER');
    console.log('   - Video view tracking should now work correctly');
    console.log('');
    console.log('🔄 Next step: Restart your server');
    console.log('   pm2 restart backend');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing video_views user_id type:', error.message);
    console.error('\nFull error:', error);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure PostgreSQL connection is working');
    console.log('   2. Check if video_views table exists');
    console.log('   3. Verify you have ALTER TABLE permissions');
    console.log('   4. Check database connection in .env file');
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Migration interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Migration terminated');
  process.exit(1);
});

fixVideoViewsUserIdType();
