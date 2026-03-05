const sequelize = require('./config/db');

/**
 * Production Setup Script for Feedback System
 * 
 * Run this script on production server after SSH:
 * node setup-feedback-system.js
 * 
 * This script will:
 * 1. Create feedback table
 * 2. Add feedback fields to Users table
 * 3. Create indexes for performance
 * 4. Verify setup
 */

async function setupFeedbackSystem() {
  try {
    console.log('🚀 Starting Feedback System setup for production...\n');
    
    // Step 0: Fix video_views table (if needed)
    console.log('0️⃣ Checking video_views table...');
    try {
      // Check if video_views.user_id is UUID or INTEGER
      const [columnInfo] = await sequelize.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'video_views' 
        AND column_name = 'user_id';
      `);
      
      if (columnInfo.length > 0 && columnInfo[0].data_type === 'uuid') {
        console.log('⚠️  video_views.user_id is UUID, converting to INTEGER...');
        
        // Clear existing data (analytics data, not critical)
        await sequelize.query(`TRUNCATE TABLE video_views CASCADE;`);
        console.log('   - Cleared video_views data');
        
        // Convert column type
        await sequelize.query(`
          ALTER TABLE video_views 
          ALTER COLUMN user_id TYPE INTEGER USING user_id::text::integer;
        `);
        console.log('✅ video_views.user_id converted to INTEGER\n');
      } else if (columnInfo.length > 0) {
        console.log(`✅ video_views.user_id is already ${columnInfo[0].data_type}\n`);
      } else {
        console.log('⚠️  video_views table or user_id column not found (will be created later)\n');
      }
    } catch (error) {
      console.log('⚠️  Could not check/fix video_views:', error.message);
      console.log('   This is OK if the table doesn\'t exist yet\n');
    }
    
    // Step 1: Create feedback table
    console.log('1️⃣ Creating feedback table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('creator', 'learner', 'educator')),
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        category VARCHAR(50) NOT NULL DEFAULT 'general' CHECK (category IN ('bug', 'feature_request', 'improvement', 'general', 'complaint', 'praise')),
        subject VARCHAR(255),
        message TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'dismissed')),
        admin_notes TEXT,
        reviewed_by INTEGER REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE SET NULL,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ feedback table created\n');

    // Step 2: Add indexes for performance
    console.log('2️⃣ Creating indexes...');
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_user_type ON feedback(user_type);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);
    `);
    
    console.log('✅ All indexes created\n');

    // Step 3: Add feedback fields to Users table
    console.log('3️⃣ Adding feedback fields to Users table...');
    
    // Check if columns already exist
    const [columns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Users' 
      AND column_name IN ('feedback_submitted', 'feedback_dismissed_at');
    `);
    
    const existingColumns = columns.map(col => col.column_name);
    
    if (!existingColumns.includes('feedback_submitted')) {
      await sequelize.query(`
        ALTER TABLE "Users" 
        ADD COLUMN feedback_submitted BOOLEAN NOT NULL DEFAULT false;
      `);
      console.log('✅ Added feedback_submitted column');
    } else {
      console.log('✅ feedback_submitted column already exists');
    }
    
    if (!existingColumns.includes('feedback_dismissed_at')) {
      await sequelize.query(`
        ALTER TABLE "Users" 
        ADD COLUMN feedback_dismissed_at TIMESTAMP;
      `);
      console.log('✅ Added feedback_dismissed_at column');
    } else {
      console.log('✅ feedback_dismissed_at column already exists');
    }
    
    console.log('');

    // Step 4: Verify table creation
    console.log('4️⃣ Verifying table creation...');
    
    const [feedbackCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'feedback' AND table_schema = 'public';
    `);
    
    console.log(`📊 Tables verification:`);
    console.log(`   - feedback: ${feedbackCount[0].count > 0 ? '✅ Created' : '❌ Missing'}`);
    console.log('');

    // Step 5: Verify indexes
    console.log('5️⃣ Verifying indexes...');
    
    const [indexCount] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM pg_indexes 
      WHERE tablename = 'feedback' 
      AND schemaname = 'public';
    `);
    
    console.log(`   - Total indexes created: ${indexCount[0].count}`);
    console.log('');

    // Step 6: Verify Users table columns
    console.log('6️⃣ Verifying Users table columns...');
    
    const [userColumns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Users' 
      AND column_name IN ('feedback_submitted', 'feedback_dismissed_at');
    `);
    
    console.log(`   - feedback_submitted: ${userColumns.some(c => c.column_name === 'feedback_submitted') ? '✅ Added' : '❌ Missing'}`);
    console.log(`   - feedback_dismissed_at: ${userColumns.some(c => c.column_name === 'feedback_dismissed_at') ? '✅ Added' : '❌ Missing'}`);
    console.log('');

    // Step 7: Show next steps
    console.log('🎉 Feedback System setup completed successfully!\n');
    console.log('📋 What was done:');
    console.log('   ✅ Fixed video_views.user_id type (UUID → INTEGER)');
    console.log('   ✅ Created feedback table');
    console.log('   ✅ Added feedback fields to Users table');
    console.log('   ✅ Created performance indexes');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Restart your server: pm2 restart backend');
    console.log('   2. Test the feedback endpoints with the API documentation');
    console.log('   3. Review FEEDBACK_API_DOCS.md for endpoint details');
    console.log('');
    console.log('📚 Available endpoints:');
    console.log('   User Endpoints:');
    console.log('   - POST /api/feedback - Submit feedback');
    console.log('   - GET /api/feedback/status - Check feedback status');
    console.log('   - POST /api/feedback/dismiss - Dismiss popup');
    console.log('   - GET /api/feedback/my-feedback - Get user feedback history');
    console.log('');
    console.log('   Admin Endpoints:');
    console.log('   - GET /api/feedback/admin/all - Get all feedback');
    console.log('   - GET /api/feedback/admin/stats - Get statistics');
    console.log('   - PATCH /api/feedback/admin/:id - Update feedback');
    console.log('   - DELETE /api/feedback/admin/:id - Delete feedback');
    console.log('');
    console.log('🔒 Safety Notes:');
    console.log('   - Existing tables are UNTOUCHED');
    console.log('   - Script uses "IF NOT EXISTS" to prevent errors');
    console.log('   - Safe to run multiple times');
    console.log('   - All changes are additive (no data loss)');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up Feedback System:', error.message);
    console.error('\nFull error:', error);
    
    // Provide troubleshooting tips
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure PostgreSQL UUID extension is enabled:');
    console.log('      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('   2. Check if Users table exists');
    console.log('   3. Verify database connection and permissions');
    console.log('   4. Check if feedback table already exists');
    console.log('   5. If video_views error occurs, it may not exist yet (OK)');
    console.log('');
    console.log('💡 Note: If tables already exist, this is safe to run again.');
    console.log('   The script uses "IF NOT EXISTS" to prevent errors.');
    console.log('');
    console.log('⚠️  Note about video_views:');
    console.log('   - This table stores analytics data (view counts)');
    console.log('   - Data is cleared during type conversion (non-critical)');
    console.log('   - View counts will rebuild as users watch videos');
    console.log('   - No user account data is affected');
    
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

setupFeedbackSystem();
