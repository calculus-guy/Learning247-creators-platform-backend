const sequelize = require('./config/db');
const path = require('path');

/**
 * Production Setup Script for UGC Agency System
 * 
 * Run this script on production server after SSH:
 * node setup-ugc-system.js
 * 
 * This script will:
 * 1. Create companies table
 * 2. Create collaboration_requests table
 * 3. Create indexes for performance
 * 4. Import companies from Excel (optional)
 * 5. Verify setup
 */

async function setupUGCSystem() {
  try {
    console.log('🚀 Starting UGC Agency System setup for production...\n');
    
    // Step 1: Create companies table
    console.log('1️⃣ Creating companies table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL UNIQUE,
        industry VARCHAR(100) NOT NULL,
        website VARCHAR(255),
        contact_name VARCHAR(255),
        contact_email VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ companies table created\n');

    // Step 2: Create collaboration_requests table
    console.log('2️⃣ Creating collaboration_requests table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS collaboration_requests (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON UPDATE CASCADE ON DELETE CASCADE,
        message TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'pending', 'responded', 'rejected')),
        sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log('✅ collaboration_requests table created\n');

    // Step 3: Create indexes for performance
    console.log('3️⃣ Creating indexes...');
    
    // Companies indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_companies_company_name ON companies(company_name);
    `);
    
    // Collaboration requests indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_collaboration_requests_user_id ON collaboration_requests(user_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_collaboration_requests_company_id ON collaboration_requests(company_id);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_collaboration_requests_status ON collaboration_requests(status);
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_collaboration_requests_sent_at ON collaboration_requests(sent_at);
    `);
    
    console.log('✅ All indexes created\n');

    // Step 4: Verify table creation
    console.log('4️⃣ Verifying table creation...');
    
    const [companiesCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'companies' AND table_schema = 'public';
    `);
    
    const [requestsCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'collaboration_requests' AND table_schema = 'public';
    `);
    
    console.log(`📊 Tables verification:`);
    console.log(`   - companies: ${companiesCount[0].count > 0 ? '✅ Created' : '❌ Missing'}`);
    console.log(`   - collaboration_requests: ${requestsCount[0].count > 0 ? '✅ Created' : '❌ Missing'}`);
    console.log('');

    // Step 5: Verify indexes
    console.log('5️⃣ Verifying indexes...');
    
    const [companiesIndexCount] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM pg_indexes 
      WHERE tablename = 'companies' 
      AND schemaname = 'public';
    `);
    
    const [requestsIndexCount] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM pg_indexes 
      WHERE tablename = 'collaboration_requests' 
      AND schemaname = 'public';
    `);
    
    console.log(`   - companies indexes: ${companiesIndexCount[0].count}`);
    console.log(`   - collaboration_requests indexes: ${requestsIndexCount[0].count}`);
    console.log('');

    // Step 6: Check if companies exist
    console.log('6️⃣ Checking companies data...');
    
    const [companiesData] = await sequelize.query(`
      SELECT COUNT(*) as count FROM companies;
    `);
    
    console.log(`   - Total companies: ${companiesData[0].count}`);
    
    if (companiesData[0].count === 0) {
      console.log('\n⚠️  No companies found in database.');
      console.log('   To import companies from Excel, run:');
      console.log('   node scripts/importCompanies.js\n');
    } else {
      console.log(`   ✅ ${companiesData[0].count} companies already loaded\n`);
    }

    // Step 7: Show next steps
    console.log('🎉 UGC Agency System setup completed successfully!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Import companies (if not done): node scripts/importCompanies.js');
    console.log('   2. Restart your server: pm2 restart backend');
    console.log('   3. Test the UGC endpoints with the API documentation');
    console.log('   4. Review UGC_AGENCY_API_DOCS.md for endpoint details');
    console.log('');
    console.log('📚 Available endpoints:');
    console.log('   User Endpoints:');
    console.log('   - GET /api/ugc/companies - Browse companies');
    console.log('   - GET /api/ugc/industries - Get industries');
    console.log('   - GET /api/ugc/companies/:id - Get company details');
    console.log('   - POST /api/ugc/companies/:id/collaborate - Send collaboration request');
    console.log('   - GET /api/ugc/my-requests - Get user request history');
    console.log('');
    console.log('   Admin Endpoints:');
    console.log('   - GET /api/ugc/admin/requests - Get all requests');
    console.log('   - GET /api/ugc/admin/stats - Get statistics');
    console.log('   - PATCH /api/ugc/admin/requests/:id - Update request status');
    console.log('');
    console.log('🔒 Safety Notes:');
    console.log('   - Existing tables are UNTOUCHED');
    console.log('   - Script uses "IF NOT EXISTS" to prevent errors');
    console.log('   - Safe to run multiple times');
    console.log('   - All changes are additive (no data loss)');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up UGC Agency System:', error.message);
    console.error('\nFull error:', error);
    
    // Provide troubleshooting tips
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure PostgreSQL UUID extension is enabled:');
    console.log('      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('   2. Check if Users table exists');
    console.log('   3. Verify database connection and permissions');
    console.log('   4. Check if tables already exist');
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

setupUGCSystem();
