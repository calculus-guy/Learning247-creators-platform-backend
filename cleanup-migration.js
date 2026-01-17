const { Sequelize } = require('sequelize');
require('dotenv').config();

// Use development settings (no SSL)
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: false
    }
  }
);

async function cleanupMigration() {
  try {
    console.log('🔧 Cleaning up migration state...\n');
    
    // Check if wallet_accounts table exists
    const [results] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'wallet_accounts';
    `);
    
    if (results.length > 0) {
      console.log('⚠️ wallet_accounts table exists, dropping it...');
      await sequelize.query('DROP TABLE IF EXISTS wallet_accounts CASCADE;');
      console.log('✅ wallet_accounts table dropped');
    }
    
    // Check and drop other tables that might exist
    const tablesToDrop = [
      'financial_transactions',
      'idempotency_keys', 
      'audit_logs',
      'withdrawal_limits',
      'fraud_rules',
      'fraud_alerts',
      'manual_review_queue',
      'webhook_events',
      'bank_accounts'
    ];
    
    for (const table of tablesToDrop) {
      const [tableExists] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${table}';
      `);
      
      if (tableExists.length > 0) {
        console.log(`⚠️ ${table} table exists, dropping it...`);
        await sequelize.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
        console.log(`✅ ${table} table dropped`);
      }
    }
    
    console.log('\n🔧 Dropping indexes...');
    
    // Drop indexes that might exist
    const indexesToDrop = [
      'idempotency_keys_user_id',
      'idempotency_keys_expires_at',
      'idempotency_keys_operation_type',
      'wallet_accounts_user_id',
      'wallet_accounts_currency'
    ];
    
    for (const index of indexesToDrop) {
      try {
        await sequelize.query(`DROP INDEX IF EXISTS ${index};`);
        console.log(`✅ Index ${index} dropped`);
      } catch (error) {
        console.log(`⚠️ Index ${index} doesn't exist or already dropped`);
      }
    }
    
    console.log('\n🎉 Cleanup completed successfully!');
    console.log('You can now run: npx sequelize-cli db:migrate\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup Error:', error.message);
    console.error('\nFull error details:', error);
    process.exit(1);
  }
}

cleanupMigration();