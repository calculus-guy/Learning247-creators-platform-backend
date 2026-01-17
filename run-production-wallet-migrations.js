const { Sequelize } = require('sequelize');
require('dotenv').config();

// Database configuration
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

async function runProductionWalletMigrations() {
  try {
    console.log('🚀 Starting Multi-Currency Wallet System Migration for Production...\n');
    
    // Test database connection
    console.log('1️⃣ Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful\n');
    
    // Check if migrations table exists
    console.log('2️⃣ Checking migration tracking...');
    const [migrationTables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'SequelizeMeta'
    `);
    
    if (migrationTables.length === 0) {
      console.log('⚠️  SequelizeMeta table not found. Creating it...');
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
          name VARCHAR(255) NOT NULL PRIMARY KEY
        )
      `);
      console.log('✅ SequelizeMeta table created');
    }
    console.log('✅ Migration tracking ready\n');
    
    // Check which migrations have already been run
    console.log('3️⃣ Checking existing migrations...');
    const [existingMigrations] = await sequelize.query(`
      SELECT name FROM "SequelizeMeta" 
      WHERE name IN (
        '20250117000001-create-multi-currency-wallet-system.js',
        '20250117000002-create-fraud-detection-system.js'
      )
    `);
    
    const completedMigrations = existingMigrations.map(row => row.name);
    console.log('Completed migrations:', completedMigrations);
    console.log('✅ Migration status checked\n');
    
    // Migration 1: Multi-Currency Wallet System
    const migration1 = '20250117000001-create-multi-currency-wallet-system.js';
    if (!completedMigrations.includes(migration1)) {
      console.log('4️⃣ Running Multi-Currency Wallet System Migration...');
      
      // Enable UUID extension if not exists
      console.log('   📦 Enabling UUID extension...');
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
      console.log('   ✅ UUID extensions enabled');
      
      // Create wallet_accounts table
      console.log('   💰 Creating wallet_accounts table...');
      const [walletTables] = await sequelize.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'wallet_accounts'
      `);
      
      if (walletTables.length === 0) {
        await sequelize.query(`
          CREATE TABLE wallet_accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
            currency VARCHAR(3) NOT NULL CHECK (currency IN ('NGN', 'USD')),
            balance_available BIGINT NOT NULL DEFAULT 0,
            balance_pending BIGINT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, currency)
          )
        `);
        
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user_id ON wallet_accounts(user_id)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_wallet_accounts_currency ON wallet_accounts(currency)');
        console.log('   ✅ wallet_accounts table created');
      } else {
        console.log('   ⚠️  wallet_accounts table already exists');
      }
      
      // Create idempotency_keys table
      console.log('   🔑 Creating idempotency_keys table...');
      const [idempotencyTables] = await sequelize.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'idempotency_keys'
      `);
      
      if (idempotencyTables.length === 0) {
        await sequelize.query(`
          CREATE TYPE idempotency_status AS ENUM ('processing', 'completed', 'failed')
        `);
        
        await sequelize.query(`
          CREATE TABLE idempotency_keys (
            key UUID PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
            operation_type VARCHAR(50) NOT NULL,
            operation_data JSONB NOT NULL,
            result_data JSONB,
            status idempotency_status NOT NULL DEFAULT 'processing',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
          )
        `);
        
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_id ON idempotency_keys(user_id)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON idempotency_keys(expires_at)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_idempotency_keys_operation_type ON idempotency_keys(operation_type)');
        console.log('   ✅ idempotency_keys table created');
      } else {
        console.log('   ⚠️  idempotency_keys table already exists');
      }
      
      // Create financial_transactions table
      console.log('   💸 Creating financial_transactions table...');
      const [transactionTables] = await sequelize.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'financial_transactions'
      `);
      
      if (transactionTables.length === 0) {
        await sequelize.query(`
          CREATE TYPE transaction_type AS ENUM ('credit', 'debit', 'transfer_in', 'transfer_out')
        `);
        
        await sequelize.query(`
          CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled')
        `);
        
        await sequelize.query(`
          CREATE TYPE gateway_type AS ENUM ('paystack', 'stripe')
        `);
        
        await sequelize.query(`
          CREATE TABLE financial_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            wallet_id UUID NOT NULL REFERENCES wallet_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE,
            transaction_type transaction_type NOT NULL,
            amount BIGINT NOT NULL,
            currency VARCHAR(3) NOT NULL,
            reference VARCHAR(50) NOT NULL UNIQUE,
            description TEXT,
            metadata JSONB,
            status transaction_status NOT NULL DEFAULT 'pending',
            gateway gateway_type,
            external_reference VARCHAR(100),
            idempotency_key UUID NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
          )
        `);
        
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_financial_transactions_wallet_id ON financial_transactions(wallet_id)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON financial_transactions(transaction_type)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_financial_transactions_currency ON financial_transactions(currency)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_financial_transactions_status ON financial_transactions(status)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_financial_transactions_created_at ON financial_transactions(created_at)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_financial_transactions_idempotency_key ON financial_transactions(idempotency_key)');
        console.log('   ✅ financial_transactions table created');
      } else {
        console.log('   ⚠️  financial_transactions table already exists');
      }
      
      // Create audit_logs table
      console.log('   📋 Creating audit_logs table...');
      const [auditTables] = await sequelize.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'audit_logs'
      `);
      
      if (auditTables.length === 0) {
        await sequelize.query(`
          CREATE TABLE audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE SET NULL,
            operation_type VARCHAR(50) NOT NULL,
            resource_type VARCHAR(50) NOT NULL,
            resource_id VARCHAR(100),
            old_values JSONB,
            new_values JSONB,
            ip_address INET,
            user_agent TEXT,
            request_id UUID,
            session_id UUID,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            hash_chain VARCHAR(64)
          )
        `);
        
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_operation_type ON audit_logs(operation_type)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)');
        console.log('   ✅ audit_logs table created');
      } else {
        console.log('   ⚠️  audit_logs table already exists');
      }
      
      // Create withdrawal_limits table
      console.log('   🏦 Creating withdrawal_limits table...');
      const [limitTables] = await sequelize.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'withdrawal_limits'
      `);
      
      if (limitTables.length === 0) {
        await sequelize.query(`
          CREATE TABLE withdrawal_limits (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
            currency VARCHAR(3) NOT NULL,
            daily_limit BIGINT NOT NULL,
            monthly_limit BIGINT NOT NULL,
            daily_used BIGINT NOT NULL DEFAULT 0,
            monthly_used BIGINT NOT NULL DEFAULT 0,
            last_daily_reset DATE DEFAULT CURRENT_DATE,
            last_monthly_reset DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE)::date,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, currency)
          )
        `);
        console.log('   ✅ withdrawal_limits table created');
      } else {
        console.log('   ⚠️  withdrawal_limits table already exists');
      }
      
      // Add currency columns to existing tables
      console.log('   🔄 Adding currency columns to existing tables...');
      
      // Check and add currency to videos table
      const [videoColumns] = await sequelize.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'videos' AND column_name = 'currency'
      `);
      
      if (videoColumns.length === 0) {
        await sequelize.query(`
          ALTER TABLE videos ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'NGN'
        `);
        console.log('   ✅ Added currency column to videos table');
      } else {
        console.log('   ⚠️  Currency column already exists in videos table');
      }
      
      // Check and add currency to live_classes table
      const [liveClassColumns] = await sequelize.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'live_classes' AND column_name = 'currency'
      `);
      
      if (liveClassColumns.length === 0) {
        await sequelize.query(`
          ALTER TABLE live_classes ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'NGN'
        `);
        console.log('   ✅ Added currency column to live_classes table');
      } else {
        console.log('   ⚠️  Currency column already exists in live_classes table');
      }
      
      // Check and add currency to wallets table
      const [walletColumns] = await sequelize.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'wallets' AND column_name = 'currency'
      `);
      
      if (walletColumns.length === 0) {
        await sequelize.query(`
          ALTER TABLE wallets ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'NGN'
        `);
        console.log('   ✅ Added currency column to wallets table');
      } else {
        console.log('   ⚠️  Currency column already exists in wallets table');
      }
      
      // Create default withdrawal limits for existing users
      console.log('   👥 Creating default withdrawal limits for existing users...');
      const [ngnLimitsResult] = await sequelize.query(`
        INSERT INTO withdrawal_limits (id, user_id, currency, daily_limit, monthly_limit, last_daily_reset, last_monthly_reset, created_at)
        SELECT 
          gen_random_uuid(),
          id,
          'NGN',
          50000000,
          1000000000,
          CURRENT_DATE,
          DATE_TRUNC('month', CURRENT_DATE)::date,
          CURRENT_TIMESTAMP
        FROM "Users"
        WHERE NOT EXISTS (
          SELECT 1 FROM withdrawal_limits 
          WHERE withdrawal_limits.user_id = "Users".id 
          AND withdrawal_limits.currency = 'NGN'
        )
      `);
      
      const [usdLimitsResult] = await sequelize.query(`
        INSERT INTO withdrawal_limits (id, user_id, currency, daily_limit, monthly_limit, last_daily_reset, last_monthly_reset, created_at)
        SELECT 
          gen_random_uuid(),
          id,
          'USD',
          200000,
          5000000,
          CURRENT_DATE,
          DATE_TRUNC('month', CURRENT_DATE)::date,
          CURRENT_TIMESTAMP
        FROM "Users"
        WHERE NOT EXISTS (
          SELECT 1 FROM withdrawal_limits 
          WHERE withdrawal_limits.user_id = "Users".id 
          AND withdrawal_limits.currency = 'USD'
        )
      `);
      
      console.log(`   ✅ Created NGN limits for ${ngnLimitsResult.rowCount || 0} users`);
      console.log(`   ✅ Created USD limits for ${usdLimitsResult.rowCount || 0} users`);
      
      // Create wallet accounts for existing users
      console.log('   💳 Creating wallet accounts for existing users...');
      const [ngnWalletsResult] = await sequelize.query(`
        INSERT INTO wallet_accounts (id, user_id, currency, balance_available, balance_pending, created_at, updated_at)
        SELECT 
          gen_random_uuid(),
          id,
          'NGN',
          COALESCE((
            SELECT (total_earnings - withdrawn_amount - pending_amount) * 100
            FROM wallets 
            WHERE wallets.user_id = "Users".id
          ), 0),
          COALESCE((
            SELECT pending_amount * 100
            FROM wallets 
            WHERE wallets.user_id = "Users".id
          ), 0),
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        FROM "Users"
        WHERE NOT EXISTS (
          SELECT 1 FROM wallet_accounts 
          WHERE wallet_accounts.user_id = "Users".id 
          AND wallet_accounts.currency = 'NGN'
        )
      `);
      
      const [usdWalletsResult] = await sequelize.query(`
        INSERT INTO wallet_accounts (id, user_id, currency, balance_available, balance_pending, created_at, updated_at)
        SELECT 
          gen_random_uuid(),
          id,
          'USD',
          0,
          0,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        FROM "Users"
        WHERE NOT EXISTS (
          SELECT 1 FROM wallet_accounts 
          WHERE wallet_accounts.user_id = "Users".id 
          AND wallet_accounts.currency = 'USD'
        )
      `);
      
      console.log(`   ✅ Created NGN wallets for ${ngnWalletsResult.rowCount || 0} users`);
      console.log(`   ✅ Created USD wallets for ${usdWalletsResult.rowCount || 0} users`);
      
      // Mark migration as completed
      await sequelize.query(`
        INSERT INTO "SequelizeMeta" (name) VALUES ('${migration1}')
        ON CONFLICT (name) DO NOTHING
      `);
      
      console.log('✅ Multi-Currency Wallet System Migration completed\n');
    } else {
      console.log('4️⃣ Multi-Currency Wallet System Migration already completed\n');
    }
    
    // Migration 2: Fraud Detection System
    const migration2 = '20250117000002-create-fraud-detection-system.js';
    if (!completedMigrations.includes(migration2)) {
      console.log('5️⃣ Running Fraud Detection System Migration...');
      
      // Create fraud_rules table
      console.log('   🚨 Creating fraud_rules table...');
      const [fraudRulesTables] = await sequelize.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'fraud_rules'
      `);
      
      if (fraudRulesTables.length === 0) {
        await sequelize.query(`
          CREATE TABLE fraud_rules (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            rule_name VARCHAR(100) NOT NULL,
            rule_type VARCHAR(50) NOT NULL,
            conditions JSONB NOT NULL,
            action VARCHAR(50) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_fraud_rules_rule_type ON fraud_rules(rule_type)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_fraud_rules_is_active ON fraud_rules(is_active)');
        console.log('   ✅ fraud_rules table created');
      } else {
        console.log('   ⚠️  fraud_rules table already exists');
      }
      
      // Create fraud_alerts table
      console.log('   🔔 Creating fraud_alerts table...');
      const [fraudAlertsTables] = await sequelize.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'fraud_alerts'
      `);
      
      if (fraudAlertsTables.length === 0) {
        await sequelize.query(`
          CREATE TYPE alert_status AS ENUM ('open', 'investigating', 'resolved', 'false_positive')
        `);
        
        await sequelize.query(`
          CREATE TABLE fraud_alerts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
            transaction_id UUID REFERENCES financial_transactions(id) ON UPDATE CASCADE ON DELETE SET NULL,
            rule_id UUID NOT NULL REFERENCES fraud_rules(id) ON UPDATE CASCADE ON DELETE CASCADE,
            risk_score INTEGER NOT NULL,
            alert_type VARCHAR(50) NOT NULL,
            status alert_status NOT NULL DEFAULT 'open',
            reviewed_by INTEGER REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE SET NULL,
            reviewed_at TIMESTAMP,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user_id ON fraud_alerts(user_id)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON fraud_alerts(status)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_fraud_alerts_created_at ON fraud_alerts(created_at)');
        console.log('   ✅ fraud_alerts table created');
      } else {
        console.log('   ⚠️  fraud_alerts table already exists');
      }
      
      // Create manual_review_queue table
      console.log('   👨‍💼 Creating manual_review_queue table...');
      const [reviewQueueTables] = await sequelize.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'manual_review_queue'
      `);
      
      if (reviewQueueTables.length === 0) {
        await sequelize.query(`
          CREATE TYPE review_status AS ENUM ('pending', 'in_review', 'approved', 'rejected', 'escalated')
        `);
        
        await sequelize.query(`
          CREATE TABLE manual_review_queue (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            transaction_id UUID NOT NULL REFERENCES financial_transactions(id) ON UPDATE CASCADE ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
            review_type VARCHAR(50) NOT NULL,
            priority INTEGER NOT NULL DEFAULT 1,
            assigned_to INTEGER REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE SET NULL,
            status review_status NOT NULL DEFAULT 'pending',
            reason TEXT NOT NULL,
            resolution TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP
          )
        `);
        
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_manual_review_queue_status ON manual_review_queue(status)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_manual_review_queue_priority ON manual_review_queue(priority)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_manual_review_queue_assigned_to ON manual_review_queue(assigned_to)');
        console.log('   ✅ manual_review_queue table created');
      } else {
        console.log('   ⚠️  manual_review_queue table already exists');
      }
      
      // Create webhook_events table
      console.log('   🔗 Creating webhook_events table...');
      const [webhookTables] = await sequelize.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'webhook_events'
      `);
      
      if (webhookTables.length === 0) {
        await sequelize.query(`
          CREATE TABLE webhook_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            gateway VARCHAR(20) NOT NULL,
            event_type VARCHAR(50) NOT NULL,
            event_id VARCHAR(100) NOT NULL,
            payload JSONB NOT NULL,
            signature VARCHAR(255) NOT NULL,
            processed BOOLEAN NOT NULL DEFAULT false,
            processing_attempts INTEGER NOT NULL DEFAULT 0,
            last_processing_error TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP,
            UNIQUE(gateway, event_id)
          )
        `);
        
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_webhook_events_gateway ON webhook_events(gateway)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at)');
        console.log('   ✅ webhook_events table created');
      } else {
        console.log('   ⚠️  webhook_events table already exists');
      }
      
      // Create bank_accounts table
      console.log('   🏛️ Creating bank_accounts table...');
      const [bankAccountsTables] = await sequelize.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'bank_accounts'
      `);
      
      if (bankAccountsTables.length === 0) {
        await sequelize.query(`
          CREATE TABLE bank_accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
            currency VARCHAR(3) NOT NULL,
            bank_name VARCHAR(100) NOT NULL,
            account_number VARCHAR(50) NOT NULL,
            account_name VARCHAR(100) NOT NULL,
            routing_number VARCHAR(50),
            swift_code VARCHAR(11),
            bank_code VARCHAR(10),
            is_verified BOOLEAN NOT NULL DEFAULT false,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_bank_accounts_currency ON bank_accounts(currency)');
        await sequelize.query('CREATE INDEX IF NOT EXISTS idx_bank_accounts_is_active ON bank_accounts(is_active)');
        console.log('   ✅ bank_accounts table created');
      } else {
        console.log('   ⚠️  bank_accounts table already exists');
      }
      
      // Insert default fraud rules
      console.log('   📝 Inserting default fraud rules...');
      await sequelize.query(`
        INSERT INTO fraud_rules (id, rule_name, rule_type, conditions, action, is_active, created_at)
        VALUES 
        (
          'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          'High Velocity Withdrawals',
          'velocity_check',
          '{"operation": "withdrawal", "timeWindow": "1h", "maxCount": 5, "currency": "any"}',
          'flag_for_review',
          true,
          CURRENT_TIMESTAMP
        ),
        (
          'f47ac10b-58cc-4372-a567-0e02b2c3d480',
          'Large Amount Withdrawal',
          'amount_check',
          '{"operation": "withdrawal", "thresholds": {"NGN": 100000000, "USD": 500000}}',
          'require_manual_review',
          true,
          CURRENT_TIMESTAMP
        ),
        (
          'f47ac10b-58cc-4372-a567-0e02b2c3d481',
          'New Bank Account Usage',
          'behavior_check',
          '{"operation": "withdrawal", "checkNewBankAccount": true, "gracePeriod": "24h"}',
          'flag_for_review',
          true,
          CURRENT_TIMESTAMP
        ),
        (
          'f47ac10b-58cc-4372-a567-0e02b2c3d482',
          'Unusual Time Pattern',
          'time_pattern',
          '{"operation": "withdrawal", "unusualHours": [0, 1, 2, 3, 4, 5], "timezone": "Africa/Lagos"}',
          'increase_monitoring',
          true,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO NOTHING
      `);
      console.log('   ✅ Default fraud rules inserted');
      
      // Mark migration as completed
      await sequelize.query(`
        INSERT INTO "SequelizeMeta" (name) VALUES ('${migration2}')
        ON CONFLICT (name) DO NOTHING
      `);
      
      console.log('✅ Fraud Detection System Migration completed\n');
    } else {
      console.log('5️⃣ Fraud Detection System Migration already completed\n');
    }
    
    // Verify migration completion
    console.log('6️⃣ Verifying migration completion...');
    const [finalMigrations] = await sequelize.query(`
      SELECT name FROM "SequelizeMeta" 
      WHERE name IN (
        '20250117000001-create-multi-currency-wallet-system.js',
        '20250117000002-create-fraud-detection-system.js'
      )
      ORDER BY name
    `);
    
    console.log('✅ Completed migrations:');
    finalMigrations.forEach(migration => {
      console.log(`   - ${migration.name}`);
    });
    
    // Final verification - check key tables exist
    console.log('\n7️⃣ Final verification - checking key tables...');
    const [tables] = await sequelize.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'wallet_accounts',
        'idempotency_keys', 
        'financial_transactions',
        'audit_logs',
        'withdrawal_limits',
        'fraud_rules',
        'fraud_alerts',
        'manual_review_queue',
        'webhook_events',
        'bank_accounts'
      )
      ORDER BY table_name
    `);
    
    const expectedTables = [
      'audit_logs',
      'bank_accounts', 
      'financial_transactions',
      'fraud_alerts',
      'fraud_rules',
      'idempotency_keys',
      'manual_review_queue',
      'wallet_accounts',
      'webhook_events',
      'withdrawal_limits'
    ];
    
    const existingTables = tables.map(t => t.table_name);
    const missingTables = expectedTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length === 0) {
      console.log('✅ All required tables exist:');
      existingTables.forEach(table => {
        console.log(`   - ${table}`);
      });
    } else {
      console.log('❌ Missing tables:');
      missingTables.forEach(table => {
        console.log(`   - ${table}`);
      });
      throw new Error('Some required tables are missing');
    }
    
    console.log('\n🎉 Multi-Currency Wallet System Migration completed successfully!');
    console.log('✅ All database tables and indexes have been created');
    console.log('✅ Default data has been inserted');
    console.log('✅ Existing user data has been migrated');
    console.log('\n🚀 You can now restart your server: pm2 restart backend');
    console.log('\n📊 Migration Summary:');
    console.log('   - Multi-currency wallet accounts created for all users');
    console.log('   - Idempotency system ready for financial operations');
    console.log('   - Comprehensive audit logging enabled');
    console.log('   - Fraud detection rules configured');
    console.log('   - Withdrawal limits set (NGN: ₦500K daily, USD: $2K daily)');
    console.log('   - Currency fields added to content tables');
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Migration Error:', error.message);
    console.error('\nFull error details:', error);
    console.error('\n💡 This might be because:');
    console.error('   - Database connection failed');
    console.error('   - Tables already exist (this is usually safe to ignore)');
    console.error('   - Permission issues');
    console.error('   - Foreign key constraint violations');
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check your DATABASE_URL environment variable');
    console.error('   2. Ensure the database is accessible');
    console.error('   3. Verify you have CREATE TABLE permissions');
    console.error('   4. Check if any tables already exist and have data');
    console.error('\n🔄 You can safely re-run this script - it will skip existing tables');
    
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the migration
runProductionWalletMigrations();