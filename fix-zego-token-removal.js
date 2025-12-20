const sequelize = require('./config/db');

async function fixZegoTokenRemoval() {
  try {
    console.log('🔧 Starting ZegoCloud token removal fix...\n');
    
    // Check if zego_room_token column exists
    console.log('1️⃣ Checking if zego_room_token column exists...');
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'live_classes' 
      AND column_name = 'zego_room_token';
    `);
    
    if (results.length > 0) {
      console.log('⚠️ zego_room_token column found - removing it...');
      
      // Remove the column
      await sequelize.query(`
        ALTER TABLE live_classes 
        DROP COLUMN IF EXISTS zego_room_token;
      `);
      
      console.log('✅ zego_room_token column removed successfully\n');
    } else {
      console.log('✅ zego_room_token column already removed\n');
    }
    
    // Verify the fix
    console.log('2️⃣ Verifying table structure...');
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'live_classes' 
      AND column_name LIKE '%zego%'
      ORDER BY column_name;
    `);
    
    console.log('✅ Current ZegoCloud columns:');
    columns.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    console.log('\n🎉 ZegoCloud token removal fix completed!');
    console.log('✅ Tokens will now be generated fresh per request for security');
    console.log('\nYou can now restart your server: pm2 restart backend\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

fixZegoTokenRemoval();