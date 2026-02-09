const sequelize = require('./config/db');

async function setupCourseRevamp() {
  try {
    console.log('🚀 Starting Course Revamp Migration for production...\n');
    
    // Step 0: Safety check - show what will be changed
    console.log('🔍 SAFETY CHECK - Analyzing current database state...\n');
    
    // Check if course_enrollments table exists
    const [enrollmentsTableCheck] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'course_enrollments'
      ) as exists;
    `);
    
    if (!enrollmentsTableCheck[0].exists) {
      console.error('❌ ERROR: course_enrollments table does not exist!');
      console.error('   Please run setup-course-migration.js first');
      process.exit(1);
    }
    
    // Check if courses table exists
    const [coursesTableCheck] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'courses'
      ) as exists;
    `);
    
    if (!coursesTableCheck[0].exists) {
      console.error('❌ ERROR: courses table does not exist!');
      console.error('   Please run setup-course-migration.js first');
      process.exit(1);
    }
    
    // Count existing data
    const [enrollmentCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM course_enrollments;
    `);
    
    const [courseCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM courses;
    `);
    
    console.log('📊 Current Database State:');
    console.log(`   - Courses: ${courseCount[0].count}`);
    console.log(`   - Enrollments: ${enrollmentCount[0].count}`);
    console.log('');
    
    // Check what changes will be made
    const [accessTypeExists] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'course_enrollments' 
        AND column_name = 'access_type'
      ) as exists;
    `);
    
    const [expiresAtExists] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'course_enrollments' 
        AND column_name = 'expires_at'
      ) as exists;
    `);
    
    const [courseIdNullable] = await sequelize.query(`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'course_enrollments' 
      AND column_name = 'course_id';
    `);
    
    console.log('📋 Changes to be applied:');
    console.log(`   ${accessTypeExists[0].exists ? '✅ SKIP' : '🔧 ADD'} - access_type column to course_enrollments`);
    console.log(`   ${expiresAtExists[0].exists ? '✅ SKIP' : '🔧 ADD'} - expires_at column to course_enrollments`);
    console.log(`   ${courseIdNullable[0].is_nullable === 'YES' ? '✅ SKIP' : '🔧 MODIFY'} - Make course_id nullable in course_enrollments`);
    console.log(`   🔧 MODIFY - Make price_usd and price_ngn nullable in courses`);
    console.log(`   ℹ️  INFO - Existing course and enrollment data will NOT be deleted`);
    console.log(`   ℹ️  INFO - Only schema changes will be applied`);
    console.log('');
    
    console.log('⚠️  IMPORTANT: Make sure you have a database backup before proceeding!');
    console.log('');
    console.log('Press Ctrl+C within 5 seconds to cancel...');
    
    // Wait 5 seconds before proceeding
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('');
    console.log('✅ Proceeding with migration...\n');
    console.log('============================================================\n');
    
    // Step 1: Add access_type enum and column to course_enrollments
    console.log('1️⃣ Adding access_type to course_enrollments...');
    
    // First, check if the enum type already exists
    const [enumCheck] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'enum_course_enrollments_access_type'
      ) as exists;
    `);
    
    if (!enumCheck[0].exists) {
      // Create the enum type
      await sequelize.query(`
        CREATE TYPE enum_course_enrollments_access_type AS ENUM ('individual', 'monthly', 'yearly');
      `);
      console.log('✅ Created access_type enum type');
    } else {
      console.log('✅ access_type enum type already exists');
    }
    
    // Check if column exists
    const [columnCheck] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'course_enrollments' 
        AND column_name = 'access_type'
      ) as exists;
    `);
    
    if (!columnCheck[0].exists) {
      // Add the column
      await sequelize.query(`
        ALTER TABLE course_enrollments 
        ADD COLUMN access_type enum_course_enrollments_access_type NOT NULL DEFAULT 'individual';
      `);
      console.log('✅ Added access_type column to course_enrollments');
    } else {
      console.log('✅ access_type column already exists');
    }
    console.log('');

    // Step 2: Add expires_at column to course_enrollments
    console.log('2️⃣ Adding expires_at to course_enrollments...');
    
    const [expiresCheck] = await sequelize.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'course_enrollments' 
        AND column_name = 'expires_at'
      ) as exists;
    `);
    
    if (!expiresCheck[0].exists) {
      await sequelize.query(`
        ALTER TABLE course_enrollments 
        ADD COLUMN expires_at TIMESTAMP NULL;
      `);
      console.log('✅ Added expires_at column to course_enrollments');
    } else {
      console.log('✅ expires_at column already exists');
    }
    console.log('');

    // Step 3: Make course_id nullable in course_enrollments
    console.log('3️⃣ Making course_id nullable in course_enrollments...');
    
    // First, drop the unique constraint if it exists
    try {
      await sequelize.query(`
        ALTER TABLE course_enrollments 
        DROP CONSTRAINT IF EXISTS unique_user_course_enrollment;
      `);
      console.log('✅ Dropped unique_user_course_enrollment constraint');
    } catch (error) {
      console.log('⚠️  Constraint might not exist, continuing...');
    }
    
    // Make course_id nullable
    await sequelize.query(`
      ALTER TABLE course_enrollments 
      ALTER COLUMN course_id DROP NOT NULL;
    `);
    console.log('✅ Made course_id nullable in course_enrollments');
    console.log('');

    // Step 4: Add index for access_type
    console.log('4️⃣ Adding index for access_type...');
    
    try {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_enrollments_access_type 
        ON course_enrollments(access_type);
      `);
      console.log('✅ Added index for access_type');
    } catch (error) {
      console.log('⚠️  Index might already exist, continuing...');
    }
    console.log('');

    // Step 5: Add index for expires_at
    console.log('5️⃣ Adding index for expires_at...');
    
    try {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_enrollments_expires_at 
        ON course_enrollments(expires_at);
      `);
      console.log('✅ Added index for expires_at');
    } catch (error) {
      console.log('⚠️  Index might already exist, continuing...');
    }
    console.log('');

    // Step 6: Update courses table - make prices nullable
    console.log('6️⃣ Making price fields nullable in courses table...');
    
    await sequelize.query(`
      ALTER TABLE courses 
      ALTER COLUMN price_usd DROP NOT NULL,
      ALTER COLUMN price_usd DROP DEFAULT;
    `);
    console.log('✅ Made price_usd nullable');
    
    await sequelize.query(`
      ALTER TABLE courses 
      ALTER COLUMN price_ngn DROP NOT NULL,
      ALTER COLUMN price_ngn DROP DEFAULT;
    `);
    console.log('✅ Made price_ngn nullable');
    console.log('');

    // Step 7: Check existing price data (DO NOT CLEAR - just report)
    console.log('7️⃣ Checking existing price data in courses...');
    
    const [priceCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM courses 
      WHERE price_usd IS NOT NULL OR price_ngn IS NOT NULL;
    `);
    
    if (priceCount[0].count > 0) {
      console.log(`⚠️  Found ${priceCount[0].count} courses with price data`);
      console.log('   NOTE: Prices are now managed in .env, not database');
      console.log('   Existing price data will be IGNORED by the application');
      console.log('   You can manually clear them later if needed with:');
      console.log('   UPDATE courses SET price_usd = NULL, price_ngn = NULL;');
    } else {
      console.log('✅ No price data found in courses table');
    }
    console.log('');

    // Step 8: Verify all changes
    console.log('8️⃣ Verifying migration...');
    
    const [verification] = await sequelize.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'course_enrollments' 
      AND column_name IN ('access_type', 'expires_at', 'course_id')
      ORDER BY column_name;
    `);
    
    console.log('📊 course_enrollments columns:');
    verification.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    console.log('');
    
    const [coursesVerification] = await sequelize.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'courses' 
      AND column_name IN ('price_usd', 'price_ngn')
      ORDER BY column_name;
    `);
    
    console.log('📊 courses columns:');
    coursesVerification.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    console.log('');

    // Step 9: Show statistics
    console.log('9️⃣ Database statistics...');
    
    const [enrollmentStats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_enrollments,
        COUNT(CASE WHEN access_type = 'individual' THEN 1 END) as individual,
        COUNT(CASE WHEN access_type = 'monthly' THEN 1 END) as monthly,
        COUNT(CASE WHEN access_type = 'yearly' THEN 1 END) as yearly,
        COUNT(CASE WHEN expires_at IS NOT NULL THEN 1 END) as with_expiry,
        COUNT(CASE WHEN course_id IS NULL THEN 1 END) as all_courses_access
      FROM course_enrollments;
    `);
    
    console.log('📈 Enrollment Statistics:');
    console.log(`   - Total enrollments: ${enrollmentStats[0].total_enrollments}`);
    console.log(`   - Individual: ${enrollmentStats[0].individual}`);
    console.log(`   - Monthly: ${enrollmentStats[0].monthly}`);
    console.log(`   - Yearly: ${enrollmentStats[0].yearly}`);
    console.log(`   - With expiry date: ${enrollmentStats[0].with_expiry}`);
    console.log(`   - All-courses access: ${enrollmentStats[0].all_courses_access}`);
    console.log('');

    // Step 10: Show next steps
    console.log('🎉 Course Revamp Migration completed successfully!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Update your .env file with pricing configuration:');
    console.log('      - VALENTINE_PROMO_CODE=VALENTINE2025');
    console.log('      - VALENTINE_PROMO_END=2026-02-28T23:59:59');
    console.log('      - COURSE_PRICE_INDIVIDUAL_NGN=25000');
    console.log('      - COURSE_PRICE_MONTHLY_NGN=35000');
    console.log('      - COURSE_PRICE_YEARLY_NGN=280000');
    console.log('      - COURSE_PRICE_INDIVIDUAL_USD=30');
    console.log('      - COURSE_PRICE_MONTHLY_USD=42');
    console.log('      - COURSE_PRICE_YEARLY_USD=336');
    console.log('      - PROMO_PRICE_INDIVIDUAL_NGN=20000');
    console.log('      - PROMO_PRICE_MONTHLY_NGN=25000');
    console.log('      - PROMO_PRICE_YEARLY_NGN=250000');
    console.log('      - PROMO_PRICE_INDIVIDUAL_USD=24');
    console.log('      - PROMO_PRICE_MONTHLY_USD=30');
    console.log('      - PROMO_PRICE_YEARLY_USD=300');
    console.log('');
    console.log('   2. Restart your server: pm2 restart backend');
    console.log('');
    console.log('   3. Test the updated endpoints:');
    console.log('      - POST /api/courses/purchase (new endpoint)');
    console.log('      - GET /api/admin/course-enrollments?accessType=monthly');
    console.log('      - GET /api/admin/course-enrollments?expiryStatus=active');
    console.log('      - GET /api/admin/course-enrollments/expiring-soon');
    console.log('');
    console.log('📚 Documentation:');
    console.log('   - IMPLEMENTATION_COMPLETE.md');
    console.log('   - ADMIN_COURSE_ENROLLMENT_API.md');
    console.log('   - ADMIN_FEATURES_COMPLETE.md');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running Course Revamp Migration:', error.message);
    console.error('\nFull error:', error);
    
    // Provide troubleshooting tips
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure you have backup of your database before running migrations');
    console.log('   2. Check if course_enrollments table exists');
    console.log('   3. Check if courses table exists');
    console.log('   4. Verify database connection and permissions');
    console.log('   5. Check PostgreSQL version (should be 9.1+)');
    console.log('');
    console.log('🔄 Rollback (if needed):');
    console.log('   If you need to rollback, run these SQL commands:');
    console.log('   ALTER TABLE course_enrollments DROP COLUMN IF EXISTS access_type;');
    console.log('   ALTER TABLE course_enrollments DROP COLUMN IF EXISTS expires_at;');
    console.log('   ALTER TABLE course_enrollments ALTER COLUMN course_id SET NOT NULL;');
    console.log('   DROP TYPE IF EXISTS enum_course_enrollments_access_type;');
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
setupCourseRevamp();
