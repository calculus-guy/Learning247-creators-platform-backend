const sequelize = require('./config/db');

/**
 * Drop Price Columns from Courses Table
 * 
 * This script removes the deprecated price_usd and price_ngn columns
 * from the courses table since pricing is now managed via .env
 */

async function dropCoursePriceColumns() {
  try {
    console.log('🗑️  Starting migration to drop price columns from courses table...\n');
    
    // Step 1: Verify courses table exists
    console.log('1️⃣ Verifying courses table exists...');
    
    const [tableCheck] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'courses'
      ) as exists;
    `);
    
    if (!tableCheck[0].exists) {
      console.error('❌ ERROR: courses table does not exist!');
      process.exit(1);
    }
    
    console.log('✅ courses table exists\n');
    
    // Step 2: Check if columns exist
    console.log('2️⃣ Checking if price columns exist...');
    
    const [priceUsdCheck] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'courses' 
        AND column_name = 'price_usd'
      ) as exists;
    `);
    
    const [priceNgnCheck] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'courses' 
        AND column_name = 'price_ngn'
      ) as exists;
    `);
    
    const priceUsdExists = priceUsdCheck[0].exists;
    const priceNgnExists = priceNgnCheck[0].exists;
    
    console.log(`   - price_usd: ${priceUsdExists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    console.log(`   - price_ngn: ${priceNgnExists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
    console.log('');
    
    if (!priceUsdExists && !priceNgnExists) {
      console.log('✅ Price columns already dropped. Nothing to do!\n');
      process.exit(0);
    }
    
    // Step 3: Count courses with price data (for information)
    console.log('3️⃣ Checking for existing price data...');
    
    const [courseCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM courses;
    `);
    
    let coursesWithPrices = 0;
    if (priceUsdExists || priceNgnExists) {
      const [priceDataCount] = await sequelize.query(`
        SELECT COUNT(*) as count FROM courses 
        WHERE ${priceUsdExists ? 'price_usd IS NOT NULL' : '1=0'}
        ${priceNgnExists ? 'OR price_ngn IS NOT NULL' : ''};
      `);
      coursesWithPrices = priceDataCount[0].count;
    }
    
    console.log(`   - Total courses: ${courseCount[0].count}`);
    console.log(`   - Courses with price data: ${coursesWithPrices}`);
    console.log('');
    
    if (coursesWithPrices > 0) {
      console.log('⚠️  WARNING: This will permanently delete price data from the database!');
      console.log('   Pricing is now managed via .env configuration.');
      console.log('');
    }
    
    console.log('⏳ Waiting 5 seconds before proceeding...');
    console.log('   Press Ctrl+C to cancel\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 4: Drop price_usd column
    if (priceUsdExists) {
      console.log('4️⃣ Dropping price_usd column...');
      
      await sequelize.query(`
        ALTER TABLE courses 
        DROP COLUMN IF EXISTS price_usd;
      `);
      
      console.log('✅ price_usd column dropped\n');
    } else {
      console.log('4️⃣ Skipping price_usd (already dropped)\n');
    }
    
    // Step 5: Drop price_ngn column
    if (priceNgnExists) {
      console.log('5️⃣ Dropping price_ngn column...');
      
      await sequelize.query(`
        ALTER TABLE courses 
        DROP COLUMN IF EXISTS price_ngn;
      `);
      
      console.log('✅ price_ngn column dropped\n');
    } else {
      console.log('5️⃣ Skipping price_ngn (already dropped)\n');
    }
    
    // Step 6: Verify columns are dropped
    console.log('6️⃣ Verifying columns are dropped...');
    
    const [finalCheck] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'courses' 
      AND column_name IN ('price_usd', 'price_ngn');
    `);
    
    if (finalCheck.length === 0) {
      console.log('✅ Verification successful - both columns dropped\n');
    } else {
      console.log('⚠️  WARNING: Some columns still exist:');
      finalCheck.forEach(col => {
        console.log(`   - ${col.column_name}`);
      });
      console.log('');
    }
    
    // Step 7: Show remaining columns
    console.log('7️⃣ Remaining courses table structure:');
    
    const [columns] = await sequelize.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'courses'
      ORDER BY ordinal_position;
    `);
    
    console.log('');
    columns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`   - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
    });
    console.log('');
    
    // Step 8: Success message
    console.log('============================================================\n');
    console.log('🎉 Migration completed successfully!\n');
    console.log('✅ Changes applied:');
    if (priceUsdExists) console.log('   - Dropped price_usd column');
    if (priceNgnExists) console.log('   - Dropped price_ngn column');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Restart your server: pm2 restart backend');
    console.log('   2. Test course endpoints:');
    console.log('      - GET /api/courses/:id (should NOT show prices)');
    console.log('      - POST /api/courses/purchase (should work with .env prices)');
    console.log('');
    console.log('💡 Pricing is now managed via .env configuration:');
    console.log('   - COURSE_PRICE_INDIVIDUAL_NGN=25000');
    console.log('   - COURSE_PRICE_MONTHLY_NGN=35000');
    console.log('   - COURSE_PRICE_YEARLY_NGN=280000');
    console.log('   - (and USD equivalents)');
    console.log('');
    console.log('============================================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error dropping price columns:', error.message);
    console.error('\nFull error:', error);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check database connection');
    console.log('   2. Verify you have ALTER TABLE permissions');
    console.log('   3. Check if columns are referenced by foreign keys or constraints');
    console.log('');
    console.log('🔄 Rollback (if needed):');
    console.log('   You can manually add the columns back with:');
    console.log('   ALTER TABLE courses ADD COLUMN price_usd DECIMAL(10,2) NULL;');
    console.log('   ALTER TABLE courses ADD COLUMN price_ngn DECIMAL(10,2) NULL;');
    console.log('');
    
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

// Run the migration
dropCoursePriceColumns();
