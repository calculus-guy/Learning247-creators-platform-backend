const sequelize = require('./config/db');

async function addCategoryToLiveClasses() {
  try {
    console.log('🔧 Starting category field migration for live_classes...\n');
    
    // Add category column to live_classes table
    console.log('1️⃣ Adding category column to live_classes...');
    await sequelize.query(`
      ALTER TABLE live_classes 
      ADD COLUMN IF NOT EXISTS category VARCHAR(255);
    `);
    console.log('✅ category column added to live_classes\n');
    
    // Create index for better query performance
    console.log('2️⃣ Creating index on category column...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_live_classes_category 
      ON live_classes(category);
    `);
    console.log('✅ Index created on category column\n');
    
    // Verify the changes
    console.log('3️⃣ Verifying changes...');
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'live_classes' 
      AND column_name = 'category';
    `);
    
    if (columns.length > 0) {
      console.log('📋 Category column details:');
      columns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
      });
    }
    
    // Check if videos table already has category (it should)
    console.log('\n4️⃣ Checking videos table for category column...');
    const [videoColumns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'videos' 
      AND column_name = 'category';
    `);
    
    if (videoColumns.length > 0) {
      console.log('✅ Videos table already has category column');
    } else {
      console.log('⚠️  Videos table does not have category column (this is unexpected)');
    }
    
    console.log('\n🎉 Category field migration completed successfully!');
    console.log('✅ Category column has been added to live_classes table');
    console.log('✅ Index has been created for better query performance');
    console.log('✅ Both videos and live_classes now support categorization');
    console.log('\n📝 Frontend can now:');
    console.log('   - Add category field when creating videos/live classes');
    console.log('   - Filter by category: GET /videos?category=Programming');
    console.log('   - Filter by category: GET /live?category=Education');
    console.log('\n🚀 You can now restart your server: pm2 restart backend\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration Error:', error.message);
    console.error('\nFull error details:', error);
    console.error('\n💡 This might be because:');
    console.error('   - Database connection failed');
    console.error('   - Column already exists (this is usually safe to ignore)');
    console.error('   - Permission issues');
    console.error('\n🔧 Try running the script again or check your database connection.');
    process.exit(1);
  }
}

addCategoryToLiveClasses();
