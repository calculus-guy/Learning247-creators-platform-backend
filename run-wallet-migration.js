const { Sequelize } = require('sequelize');
require('dotenv').config();

// Use the same database configuration as your app
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
        sslmode: 'require'
      }
    }
  }
);

async function runWalletMigration() {
  try {
    console.log('🚀 Starting Multi-Currency Wallet System Migration...\n');
    
    // Test database connection
    console.log('1️⃣ Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful\n');
    
    // Enable UUID extension if not exists
    console.log('2️⃣ Enabling UUID extension...');
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    console.log('✅ UUID extensions enabled\n');
    
    // Create wallet_accounts table
    console.log('3️⃣ Creating wallet_accounts table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS wallet_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        currency VARCHAR(3) NOT NULL CHECK (currency IN ('NGN', 'USD')),
        balance_available BIGINT NOT NULL DEFAULT 0,
        balance_pending BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await sequelize.query(`
      ALTER TABLE wallet_accounts 
      ADD CONSTRAINT IF NOT EXISTS wallet_accounts_user_currency_unique 
      UNIQUE (user_id, currency)
    `);
    
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_wallet_accounts_user_id ON wallet_accounts(user_id)');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_wallet_accounts_currency ON wallet_accounts(currency)');
    console.log('✅ wallet_accounts table created\n');
    
    // Create idempotency_keys table
    console.log('4️⃣ Creating idempotency_keys table...');
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE idempotency_status AS ENUM ('processing', 'completed', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
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
    console.log('✅ idempotency_keys table created\n');
    
    // Create financial_transactions table
    console.log('5️⃣ Creating financial_transactions table...');
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE transaction_type AS ENUM ('credit', 'debit', 'transfer_in', 'transfer_out');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE gateway_type AS ENUM ('paystack', 'stripe');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS financial_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_id UUID NOT NULL REFERENCES wallet_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE,
        transaction_type transaction_type NOT NULL,
        amount BIGINT NOT NULL,
        currency VARCHAR(3) NOT NULL,
        reference VARCHAR(50) NOT NULL,
        description TEXT,
        metadata JSONB,
        status transaction_status NOT NULL DEFAULT 'pending',
        gateway gateway_type,
        external_reference VARCHAR(100),
        idempotency_key UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);
    
    await sequelize.query(`
      ALTER TABLE financial_transactions 
      ADD CONSTRAINT IF NOT EXISTS financial_transactions_reference_unique 
      UNIQUE (reference)
    `);
    
    await sequelize.query(`
      ALTER TABLE financial_transactions 
      ADD CONSTRAINT IF NOT EXISTS financial_transactions_idempotency_key_unique 
      UNIQUE (idempotency_key)
    `);
    
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_financial_transactions_wallet_id ON financial_transactions(wallet_id)');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON financial_transactions(transaction_type)');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_financial_transactions_currency ON financial_transactions(currency)');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_financial_transactions_status ON financial_transactions(status)');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_financial_transactions_created_at ON financial_transactions(created_at)');
    console.log('✅ financial_transactions table created\n');
    
    // Create audit_logs table
    console.log('6️⃣ Creating audit_logs table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
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
    console.log('✅ audit_logs table created\n');
    
    // Create withdrawal_limits table
    console.log('7️⃣ Creating withdrawal_limits table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS withdrawal_limits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        currency VARCHAR(3) NOT NULL,
        daily_limit BIGINT NOT NULL,
        monthly_limit BIGINT NOT NULL,
        daily_used BIGINT NOT NULL DEFAULT 0,
        monthly_used BIGINT NOT NULL DEFAULT 0,
        last_daily_reset DATE DEFAULT CURRENT_DATE,
        last_monthly_reset DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE)::date,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await sequelize.query(`
      ALTER TABLE withdrawal_limits 
      ADD CONSTRAINT IF NOT EXISTS withdrawal_limits_user_currency_unique 
      UNIQUE (user_id, currency)
    `);
    console.log('✅ withdrawal_limits table created\n');
    
    // Create fraud detection tables
    console.log('8️⃣ Creating fraud detection tables...');
    
    // fraud_rules table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS fraud_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_name VARCHAR(100) NOT NULL,
        rule_type VARCHAR(50) NOT NULL,
        conditions JSONB NOT NULL,
        action VARCHAR(50) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // fraud_alerts table
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE alert_status AS ENUM ('open', 'investigating', 'resolved', 'false_positive');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS fraud_alerts (
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
    
    // manual_review_queue table
    await sequelize.query(`
      DO $$ BEGIN
        CREATE TYPE review_status AS ENUM ('pending', 'in_review', 'approved', 'rejected', 'escalated');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS manual_review_queue (
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
    
    // webhook_events table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
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
        processed_at TIMESTAMP
      )
    `);
    
    await sequelize.query(`
      ALTER TABLE webhook_events 
      ADD CONSTRAINT IF NOT EXISTS webhook_events_gateway_event_unique 
      UNIQUE (gateway, event_id)
    `);
    
    // bank_accounts table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS bank_accounts (
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
    
    // Create indexes for fraud detection tables
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_fraud_rules_rule_type ON fraud_rules(rule_type)');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_fraud_rules_is_active ON fraud_rules(is_active)');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user_id ON fraud_alerts(user_id)');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON fraud_alerts(status)');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_manual_review_queue_status ON manual_review_queue(status)');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_webhook_events_gateway ON webhook_events(gateway)');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed)');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id)');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_bank_accounts_currency ON bank_accounts(currency)');
    console.log('✅ Fraud detection tables created\n');
    
    // Add currency columns to existing tables
    console.log('9️⃣ Adding currency columns to existing tables...');
    
    // Add currency to videos table
    await sequelize.query(`
      ALTER TABLE videos 
      ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'NGN'
    `);
    console.log('✅ Added currency column to videos table');
    
    // Add currency to live_classes table
    await sequelize.query(`
      ALTER TABLE live_classes 
      ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'NGN'
    `);
    console.log('✅ Added currency column to live_classes table');
    
    // Add currency to wallets table
    await sequelize.query(`
      ALTER TABLE wallets 
      ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'NGN'
    `);
    console.log('✅ Added currency column to wallets table\n');
    
    // Create default withdrawal limits for existing users
    console.log('🔟 Creating default withdrawal limits for existing users...');
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
    
    console.log(`✅ Created NGN limits for ${ngnLimitsResult.rowCount || 0} users`);
    console.log(`✅ Created USD limits for ${usdLimitsResult.rowCount || 0} users\n`);
    
    // Create wallet accounts for existing users
    console.log('1️⃣1️⃣ Creating wallet accounts for existing users...');
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
    
    console.log(`✅ Created NGN wallets for ${ngnWalletsResult.rowCount || 0} users`);
    console.log(`✅ Created USD wallets for ${usdWalletsResult.rowCount || 0} users\n`);
    
    // Insert default fraud rules
    console.log('1️⃣2️⃣ Inserting default fraud rules...');
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
    console.log('✅ Default fraud rules inserted\n');
    
    console.log('🎉 Multi-Currency Wallet System Migration completed successfully!');
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
    console.error('❌ Migration Error:', error.message);
    console.error('\nFull error details:', error);
    console.error('\n💡 This might be because:');
    console.error('   - Database connection failed');
    console.error('   - Tables already exist (this is usually safe to ignore)');
    console.error('   - Permission issues');
    console.error('   - Foreign key constraint violations');
    console.error('\n🔧 Try running the script again or check your database connection.');
    process.exit(1);
  }
}

// Run the migration
runWalletMigration();