const sequelize = require('./config/db');

async function fixLiveClasses() {
  try {
    console.log('🔧 Starting live_classes table fix...\n');
    
    // Add user_id column if it doesn't exist
    console.log('1️⃣ Adding user_id column...');
    await sequelize.query(`
      ALTER TABLE live_classes 
      ADD COLUMN IF NOT EXISTS user_id INTEGER 
      REFERENCES "Users"(id) 
      ON UPDATE CASCADE 
      ON DELETE CASCADE;
    `);
    console.log('✅ user_id column added to live_classes\n');
    
    // Create index
    console.log('2️⃣ Creating index...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_live_classes_user 
      ON live_classes(user_id);
    `);
    console.log('✅ Index created\n');
    
    // Update existing live classes with creator from live_hosts table
    console.log('3️⃣ Updating existing live classes with creator IDs...');
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
    console.log(`✅ Updated ${results.rowCount || 0} live classes\n`);
    
    console.log('🎉 All done! Live classes table is now fixed.');
    console.log('You can now restart your server: pm2 restart backend\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

fixLiveClasses();
