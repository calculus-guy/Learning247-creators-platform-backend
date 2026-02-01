const sequelize = require('./config/db');
jh

async function setupCourseMarketplace() {
  try {
    console.log('🚀 Starting Course Marketplace setup for production...\n');
    
    // Step 1: Create departments table
    console.log('1️⃣ Creating departments table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ Departments table created\n');

    // Step 2: Create courses table
    console.log('2️⃣ Creating courses table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        department_id UUID NOT NULL REFERENCES departments(id) ON UPDATE CASCADE ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        link TEXT NOT NULL,
        content TEXT,
        curriculum TEXT,
        duration VARCHAR(100),
        image_url TEXT,
        price_usd DECIMAL(10, 2) NOT NULL DEFAULT 35.00,
        price_ngn DECIMAL(10, 2) NOT NULL DEFAULT 50000.00,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ Courses table created\n');

    // Step 3: Create course_enrollments table
    console.log('3️⃣ Creating course_enrollments table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS course_enrollments (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        course_id UUID NOT NULL REFERENCES courses(id) ON UPDATE CASCADE ON DELETE CASCADE,
        purchase_id UUID NOT NULL REFERENCES purchases(id) ON UPDATE CASCADE ON DELETE CASCADE,
        student_name VARCHAR(255) NOT NULL,
        student_email VARCHAR(255) NOT NULL,
        student_phone VARCHAR(50) NOT NULL,
        credentials_sent BOOLEAN DEFAULT false,
        sent_by INTEGER REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE SET NULL,
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ Course enrollments table created\n');

    // Step 4: Add indexes for performance
    console.log('4️⃣ Creating indexes...');
    
    // Departments indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_departments_slug ON departments(slug);
    `);

    // Courses indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_department ON courses(department_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_active ON courses(is_active);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_courses_name ON courses(name);
    `);

    // Course enrollments indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollments_user ON course_enrollments(user_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollments_course ON course_enrollments(course_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollments_purchase ON course_enrollments(purchase_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_enrollments_credentials_sent ON course_enrollments(credentials_sent);
    `);
    
    console.log('✅ All indexes created\n');

    // Step 5: Add unique constraint for user-course enrollment
    console.log('5️⃣ Adding unique constraints...');
    await sequelize.query(`
      ALTER TABLE course_enrollments 
      ADD CONSTRAINT IF NOT EXISTS unique_user_course_enrollment 
      UNIQUE (user_id, course_id);
    `);
    console.log('✅ Unique constraints added\n');

    // Step 6: Update purchases table to support course content type
    console.log('6️⃣ Updating purchases table for course support...');
    
    // First, check if the enum already includes 'course'
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
    
    if (!existingValues.includes('course')) {
      // Add 'course' to the existing enum
      await sequelize.query(`
        ALTER TYPE enum_purchases_content_type ADD VALUE 'course';
      `);
      console.log('✅ Added "course" to purchases content_type enum\n');
    } else {
      console.log('✅ "course" already exists in purchases content_type enum\n');
    }

    // Step 7: Verify table creation
    console.log('7️⃣ Verifying table creation...');
    
    const [departmentsCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'departments' AND table_schema = 'public';
    `);
    
    const [coursesCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'courses' AND table_schema = 'public';
    `);
    
    const [enrollmentsCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'course_enrollments' AND table_schema = 'public';
    `);

    console.log(`📊 Tables verification:`);
    console.log(`   - departments: ${departmentsCount[0].count > 0 ? '✅ Created' : '❌ Missing'}`);
    console.log(`   - courses: ${coursesCount[0].count > 0 ? '✅ Created' : '❌ Missing'}`);
    console.log(`   - course_enrollments: ${enrollmentsCount[0].count > 0 ? '✅ Created' : '❌ Missing'}`);
    console.log('');

    // Step 8: Show next steps
    console.log('🎉 Course Marketplace setup completed successfully!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Import course data using: node scripts/importCourses.js');
    console.log('   2. Restart your server: pm2 restart backend');
    console.log('   3. Test the course endpoints with the API documentation');
    console.log('');
    console.log('📚 Available endpoints:');
    console.log('   - GET /api/courses/departments');
    console.log('   - GET /api/courses/departments/:id/courses');
    console.log('   - GET /api/courses/:id');
    console.log('   - POST /api/courses/:id/purchase');
    console.log('   - GET /api/courses/my-enrollments');
    console.log('   - GET /api/admin/course-enrollments');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up Course Marketplace:', error.message);
    console.error('\nFull error:', error);
    
    // Provide troubleshooting tips
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure PostgreSQL UUID extension is enabled:');
    console.log('      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('   2. Check if purchases table exists and has the required structure');
    console.log('   3. Verify Users table exists for foreign key references');
    console.log('   4. Check database connection and permissions');
    
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

setupCourseMarketplace();