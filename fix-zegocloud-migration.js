const sequelize = require('./config/db');

async function fixZegoCloudMigration() {
  try {
    console.log('🔧 Starting ZegoCloud migration fix for production...\n');
    
    // 1. Add user_id column if it doesn't exist (from original fix)
    console.log('1️⃣ Adding user_id column...');
    await sequelize.query(`
      ALTER TABLE live_classes 
      ADD COLUMN IF NOT EXISTS user_id INTEGER 
      REFERENCES "Users"(id) 
      ON UPDATE CASCADE 
      ON DELETE CASCADE;
    `);
    console.log('✅ user_id column added\n');
    
    // 2. Add ZegoCloud columns
    console.log('2️⃣ Adding ZegoCloud columns...');
    
    // Add zego_room_id
    await sequelize.query(`
      ALTER TABLE live_classes 
      ADD COLUMN IF NOT EXISTS zego_room_id VARCHAR(255);
    `);
    console.log('✅ zego_room_id column added');
    
    // Add zego_app_id
    await sequelize.query(`
      ALTER TABLE live_classes 
      ADD COLUMN IF NOT EXISTS zego_app_id VARCHAR(255);
    `);
    console.log('✅ zego_app_id column added');
    
    // Add streaming_provider with enum
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE streaming_provider_enum AS ENUM ('mux', 'zegocloud');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await sequelize.query(`
      ALTER TABLE live_classes 
      ADD COLUMN IF NOT EXISTS streaming_provider streaming_provider_enum DEFAULT 'zegocloud';
    `);
    console.log('✅ streaming_provider column added');
    
    // Add zego_room_token
    await sequelize.query(`
      ALTER TABLE live_classes 
      ADD COLUMN IF NOT EXISTS zego_room_token TEXT;
    `);
    console.log('✅ zego_room_token column added');
    
    // Add max_participants
    await sequelize.query(`
      ALTER TABLE live_classes 
      ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT 50;
    `);
    console.log('✅ max_participants column added\n');
    
    // 3. Create indexes
    console.log('3️⃣ Creating indexes...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_live_classes_user 
      ON live_classes(user_id);
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_live_classes_provider 
      ON live_classes(streaming_provider);
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_live_classes_zego_room 
      ON live_classes(zego_room_id);
    `);
    console.log('✅ Indexes created\n');
    
    // 4. Update existing live classes with creator from live_hosts table
    console.log('4️⃣ Updating existing live classes with creator IDs...');
    const [results] = await sequelize.query(`
      UPDATE live_classes 
      SET user_id = (
        SELECT user_id 
        FROM live_hosts 
        WHERE live_hosts.live_class_id = live_classes.id 
        AND live_hosts.role = 'creator' 
        LIMIT 1
      )
      WHERE user_id IS NULL;
    `);
    console.log(`✅ Updated ${results.rowCount || 0} live classes with creator IDs\n`);
    
    // 5. Set default streaming provider for existing classes
    console.log('5️⃣ Setting default streaming provider for existing classes...');
    const [providerResults] = await sequelize.query(`
      UPDATE live_classes 
      SET streaming_provider = 'mux'
      WHERE streaming_provider IS NULL 
      AND (mux_stream_id IS NOT NULL OR mux_playback_id IS NOT NULL);
    `);
    console.log(`✅ Updated ${providerResults.rowCount || 0} existing classes to use Mux\n`);
    
    // 6. Verify the changes
    console.log('6️⃣ Verifying changes...');
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'live_classes' 
      AND column_name IN ('user_id', 'zego_room_id', 'zego_app_id', 'streaming_provider', 'zego_room_token', 'max_participants')
      ORDER BY column_name;
    `);
    
    console.log('📋 Added columns:');
    columns.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
    });
    
    console.log('\n🎉 ZegoCloud migration completed successfully!');
    console.log('✅ All ZegoCloud fields have been added to live_classes table');
    console.log('✅ Existing data has been preserved');
    console.log('✅ Indexes have been created for performance');
    console.log('\n🚀 You can now restart your server: pm2 restart backend\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration Error:', error.message);
    console.error('\nFull error details:', error);
    console.error('\n💡 This might be because:');
    console.error('   - Database connection failed');
    console.error('   - Columns already exist (this is usually safe to ignore)');
    console.error('   - Permission issues');
    console.error('\n🔧 Try running the script again or check your database connection.');
    process.exit(1);
  }
}

// Run the migration
console.log('🚀 Starting ZegoCloud Production Migration...');
console.log('📅 Date:', new Date().toISOString());
console.log('🗄️  Database:', process.env.DB_NAME || 'Unknown');
console.log('🌐 Environment:', process.env.NODE_ENV || 'Unknown');
console.log('─'.repeat(50));

fixZegoCloudMigration();