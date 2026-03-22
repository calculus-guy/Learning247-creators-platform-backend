const sequelize = require('./config/db');

/**
 * Production Setup Script for Quiz Platform
 * 
 * Run this script on production server after SSH:
 * node setup-quiz-platform.js
 * 
 * This script will:
 * 1. Enable UUID extension
 * 2. Create all 9 quiz tables
 * 3. Create indexes for performance
 * 4. Verify setup
 * 5. Show next steps
 */

async function setupQuizPlatform() {
  try {
    console.log('🎮 Starting Quiz Platform setup for production...\n');
    
    // Step 0: Enable UUID extension
    console.log('0️⃣ Enabling UUID extension...');
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('✅ UUID extension enabled\n');

    // Step 1: Create quiz_categories table
    console.log('1️⃣ Creating quiz_categories table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS quiz_categories (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        question_count INTEGER DEFAULT 0 NOT NULL,
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_quiz_categories_name 
      ON quiz_categories(name);
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_quiz_categories_is_active 
      ON quiz_categories(is_active);
    `);
    console.log('✅ quiz_categories table created\n');

    // Step 2: Create quiz_questions table
    console.log('2️⃣ Creating quiz_questions table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS quiz_questions (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        category_id UUID NOT NULL REFERENCES quiz_categories(id) ON UPDATE CASCADE ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_answer VARCHAR(1) NOT NULL CHECK (correct_answer IN ('a', 'b', 'c', 'd')),
        difficulty VARCHAR(10) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
        usage_count INTEGER DEFAULT 0 NOT NULL,
        created_by INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_quiz_questions_category_difficulty 
      ON quiz_questions(category_id, difficulty);
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_quiz_questions_text 
      ON quiz_questions USING gin(to_tsvector('english', question_text));
    `);
    console.log('✅ quiz_questions table created\n');

    // Step 3: Create quiz_tournaments table
    console.log('3️⃣ Creating quiz_tournaments table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS quiz_tournaments (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        format VARCHAR(20) NOT NULL CHECK (format IN ('speed_run', 'classic', 'knockout', 'battle_royale')),
        entry_fee INTEGER NOT NULL,
        prize_distribution JSONB NOT NULL,
        category_id UUID NOT NULL REFERENCES quiz_categories(id) ON UPDATE CASCADE ON DELETE CASCADE,
        max_participants INTEGER NOT NULL,
        min_participants INTEGER NOT NULL,
        registration_deadline TIMESTAMP NOT NULL,
        start_time TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'open', 'in_progress', 'completed', 'cancelled')) DEFAULT 'draft',
        current_round INTEGER DEFAULT 0,
        total_rounds INTEGER,
        prize_pool INTEGER DEFAULT 0,
        created_by INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        proposed_by INTEGER REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_quiz_tournaments_status_start 
      ON quiz_tournaments(status, start_time);
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_quiz_tournaments_registration 
      ON quiz_tournaments(registration_deadline);
    `);
    console.log('✅ quiz_tournaments table created\n');

    // Step 4: Create quiz_matches table
    console.log('4️⃣ Creating quiz_matches table...');
    
    // Check if table exists and has tournament_id column
    const [columnCheck] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'quiz_matches' 
      AND column_name = 'tournament_id'
      AND table_schema = 'public';
    `);
    
    // If table exists but column is missing, drop and recreate
    if (columnCheck.length === 0) {
      const [tableExists] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'quiz_matches' 
        AND table_schema = 'public';
      `);
      
      if (tableExists.length > 0) {
        console.log('   ⚠️  quiz_matches table exists but missing tournament_id column. Recreating...');
        await sequelize.query(`DROP TABLE IF EXISTS quiz_matches CASCADE;`);
      }
    }
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS quiz_matches (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        match_type VARCHAR(20) NOT NULL CHECK (match_type IN ('lobby', 'tournament')),
        tournament_id UUID REFERENCES quiz_tournaments(id) ON UPDATE CASCADE ON DELETE SET NULL,
        participants JSONB NOT NULL,
        questions JSONB NOT NULL,
        question_start_times JSONB,
        status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'active', 'completed', 'cancelled')) DEFAULT 'pending',
        winner_id INTEGER REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE SET NULL,
        escrow_amount INTEGER DEFAULT 0,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_quiz_matches_status_created 
      ON quiz_matches(status, created_at DESC);
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_quiz_matches_tournament 
      ON quiz_matches(tournament_id);
    `);
    console.log('✅ quiz_matches table created\n');

    // Step 4b: Add missing columns to quiz_matches (safe - uses IF NOT EXISTS)
    console.log('4️⃣b Adding missing columns to quiz_matches...');
    const [matchColumns] = await sequelize.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'quiz_matches' AND table_schema = 'public';
    `);
    const existingMatchCols = matchColumns.map(r => r.column_name);

    if (!existingMatchCols.includes('challenger_id')) {
      await sequelize.query(`ALTER TABLE quiz_matches ADD COLUMN challenger_id INTEGER REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE SET NULL;`);
      console.log('   ✅ Added challenger_id');
    }
    if (!existingMatchCols.includes('opponent_id')) {
      await sequelize.query(`ALTER TABLE quiz_matches ADD COLUMN opponent_id INTEGER REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE SET NULL;`);
      console.log('   ✅ Added opponent_id');
    }
    if (!existingMatchCols.includes('counter_offer_id')) {
      await sequelize.query(`ALTER TABLE quiz_matches ADD COLUMN counter_offer_id UUID;`);
      console.log('   ✅ Added counter_offer_id');
    }
    if (!existingMatchCols.includes('expires_at')) {
      await sequelize.query(`ALTER TABLE quiz_matches ADD COLUMN expires_at TIMESTAMP;`);
      console.log('   ✅ Added expires_at');
    }
    console.log('✅ quiz_matches columns up to date\n');

    // Step 5: Create quiz_tournament_participants table
    console.log('5️⃣ Creating quiz_tournament_participants table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS quiz_tournament_participants (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        tournament_id UUID NOT NULL REFERENCES quiz_tournaments(id) ON UPDATE CASCADE ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        entry_fee_paid INTEGER NOT NULL,
        current_round INTEGER DEFAULT 0,
        status VARCHAR(20) NOT NULL CHECK (status IN ('registered', 'active', 'eliminated', 'winner')) DEFAULT 'registered',
        total_score INTEGER DEFAULT 0,
        average_time INTEGER DEFAULT 0,
        placement INTEGER,
        prize_won INTEGER DEFAULT 0,
        registered_at TIMESTAMP DEFAULT NOW() NOT NULL,
        eliminated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(tournament_id, user_id)
      );
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_quiz_tournament_participants_tournament_user 
      ON quiz_tournament_participants(tournament_id, user_id);
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_quiz_tournament_participants_tournament_status 
      ON quiz_tournament_participants(tournament_id, status);
    `);
    console.log('✅ quiz_tournament_participants table created\n');

    // Step 6: Create quiz_tournament_rounds table
    console.log('6️⃣ Creating quiz_tournament_rounds table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS quiz_tournament_rounds (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        tournament_id UUID NOT NULL REFERENCES quiz_tournaments(id) ON UPDATE CASCADE ON DELETE CASCADE,
        round_number INTEGER NOT NULL,
        questions JSONB NOT NULL,
        participants JSONB NOT NULL,
        eliminated_users JSONB,
        status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'active', 'completed')) DEFAULT 'pending',
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(tournament_id, round_number)
      );
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_quiz_tournament_rounds_tournament_round 
      ON quiz_tournament_rounds(tournament_id, round_number);
    `);
    console.log('✅ quiz_tournament_rounds table created\n');

    // Step 7: Create quiz_match_answers table
    console.log('7️⃣ Creating quiz_match_answers table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS quiz_match_answers (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        match_id UUID NOT NULL REFERENCES quiz_matches(id) ON UPDATE CASCADE ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        question_id UUID NOT NULL REFERENCES quiz_questions(id) ON UPDATE CASCADE ON DELETE CASCADE,
        selected_answer VARCHAR(1) NOT NULL CHECK (selected_answer IN ('a', 'b', 'c', 'd')),
        is_correct BOOLEAN NOT NULL,
        response_time INTEGER NOT NULL,
        client_timestamp BIGINT NOT NULL,
        server_timestamp BIGINT NOT NULL,
        latency INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_quiz_match_answers_match_user 
      ON quiz_match_answers(match_id, user_id);
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_quiz_match_answers_user_created 
      ON quiz_match_answers(user_id, created_at DESC);
    `);
    console.log('✅ quiz_match_answers table created\n');

    // Step 8: Create chuta_coin_transactions table
    console.log('8️⃣ Creating chuta_coin_transactions table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS chuta_coin_transactions (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        type VARCHAR(30) NOT NULL CHECK (type IN (
          'initial_bonus', 'purchase', 'withdrawal',
          'match_wager', 'match_win', 'match_refund',
          'tournament_entry', 'tournament_prize', 'tournament_refund',
          'admin_adjustment'
        )),
        amount INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        metadata JSONB,
        status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'reversed')) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_chuta_transactions_user_created 
      ON chuta_coin_transactions(user_id, created_at DESC);
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_chuta_transactions_type_created 
      ON chuta_coin_transactions(type, created_at DESC);
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_chuta_transactions_status 
      ON chuta_coin_transactions(status);
    `);
    console.log('✅ chuta_coin_transactions table created\n');

    // Step 9: Create user_quiz_stats table
    console.log('9️⃣ Creating user_quiz_stats table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS user_quiz_stats (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE CASCADE,
        lobby_stats JSONB DEFAULT '{}',
        tournament_stats JSONB DEFAULT '{}',
        overall_stats JSONB DEFAULT '{}',
        last_match_at TIMESTAMP,
        last_tournament_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_quiz_stats_user 
      ON user_quiz_stats(user_id);
    `);
    console.log('✅ user_quiz_stats table created\n');

    // Step 10: Verify table creation
    console.log('🔍 Verifying table creation...');
    
    const tables = [
      'quiz_categories',
      'quiz_questions',
      'quiz_matches',
      'quiz_tournaments',
      'quiz_tournament_participants',
      'quiz_tournament_rounds',
      'quiz_match_answers',
      'chuta_coin_transactions',
      'user_quiz_stats'
    ];
    
    console.log('📊 Table verification:');
    for (const table of tables) {
      const [result] = await sequelize.query(`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = '${table}' AND table_schema = 'public';
      `);
      const exists = result[0].count > 0;
      console.log(`   - ${table}: ${exists ? '✅ Created' : '❌ Missing'}`);
    }
    console.log('');

    // Step 11: Verify indexes
    console.log('🔍 Verifying indexes...');
    
    for (const table of tables) {
      const [indexCount] = await sequelize.query(`
        SELECT COUNT(*) as count 
        FROM pg_indexes 
        WHERE tablename = '${table}' 
        AND schemaname = 'public';
      `);
      console.log(`   - ${table} indexes: ${indexCount[0].count}`);
    }
    console.log('');

    // Step 12: Check current data
    console.log('📈 Checking current data...');
    
    const [categoriesCount] = await sequelize.query(`SELECT COUNT(*) as count FROM quiz_categories;`);
    const [questionsCount] = await sequelize.query(`SELECT COUNT(*) as count FROM quiz_questions;`);
    const [matchesCount] = await sequelize.query(`SELECT COUNT(*) as count FROM quiz_matches;`);
    const [tournamentsCount] = await sequelize.query(`SELECT COUNT(*) as count FROM quiz_tournaments;`);
    const [transactionsCount] = await sequelize.query(`SELECT COUNT(*) as count FROM chuta_coin_transactions;`);
    
    console.log(`   - Categories: ${categoriesCount[0].count}`);
    console.log(`   - Questions: ${questionsCount[0].count}`);
    console.log(`   - Matches: ${matchesCount[0].count}`);
    console.log(`   - Tournaments: ${tournamentsCount[0].count}`);
    console.log(`   - Transactions: ${transactionsCount[0].count}`);
    console.log('');

    // Step 13: Show next steps
    console.log('🎉 Quiz Platform setup completed successfully!\n');
    console.log('📋 Next Steps:');
    console.log('   1. Restart your server: pm2 restart backend');
    console.log('   2. Create quiz categories via admin panel');
    console.log('   3. Upload questions via Excel');
    console.log('   4. Test the quiz endpoints');
    console.log('   5. Review QUIZ_PLATFORM_API.md for complete API documentation');
    console.log('');
    console.log('📚 API Documentation:');
    console.log('   - Complete API docs: docs/QUIZ_PLATFORM_API.md');
    console.log('   - Design document: .kiro/specs/quiz-platform/design.md');
    console.log('   - Requirements: .kiro/specs/quiz-platform/requirements.md');
    console.log('');
    console.log('🎮 Quick Start Guide:');
    console.log('');
    console.log('   1. Create a category:');
    console.log('      POST /api/quiz/admin/category');
    console.log('      Body: { "name": "General Knowledge", "description": "..." }');
    console.log('');
    console.log('   2. Upload questions (Excel file):');
    console.log('      POST /api/quiz/admin/questions/upload');
    console.log('      Form Data: file=questions.xlsx, categoryId=<uuid>');
    console.log('');
    console.log('   3. User registration:');
    console.log('      POST /api/quiz/user/register');
    console.log('      (Automatically credits 100 Chuta bonus)');
    console.log('');
    console.log('   4. Create a challenge:');
    console.log('      POST /api/quiz/lobby/challenge/create');
    console.log('      Body: { "wagerAmount": 100, "categoryId": "<uuid>" }');
    console.log('');
    console.log('   5. Create a tournament:');
    console.log('      POST /api/quiz/admin/tournament/create');
    console.log('      Body: {');
    console.log('        "name": "Friday Night Championship",');
    console.log('        "format": "knockout",');
    console.log('        "entryFee": 100,');
    console.log('        "categoryId": "<uuid>",');
    console.log('        "maxParticipants": 64,');
    console.log('        "startTime": "2026-03-21T20:00:00.000Z",');
    console.log('        "registrationDeadline": "2026-03-21T18:00:00.000Z"');
    console.log('      }');
    console.log('');
    console.log('📊 Database Tables Created:');
    console.log('   1. quiz_categories - Question categories');
    console.log('   2. quiz_questions - Question bank');
    console.log('   3. quiz_matches - Match records');
    console.log('   4. quiz_tournaments - Tournament records');
    console.log('   5. quiz_tournament_participants - Tournament registrations');
    console.log('   6. quiz_tournament_rounds - Tournament round data');
    console.log('   7. quiz_match_answers - Answer submissions');
    console.log('   8. chuta_coin_transactions - Currency transactions');
    console.log('   9. user_quiz_stats - User statistics');
    console.log('');
    console.log('✨ Key Features:');
    console.log('   - Lobby Mode: 1v1 challenges with wagers');
    console.log('   - Tournament Mode: Multi-player competitions');
    console.log('   - Currency System: 1 USD = 100 Chuta');
    console.log('   - Real-time: WebSocket support via Socket.io');
    console.log('   - Leaderboards: Global, Lobby, Tournament rankings');
    console.log('   - Anti-cheat: Server-side validation, rate limiting');
    console.log('   - Active Users: Redis-based tracking');
    console.log('   - Statistics: Comprehensive user performance tracking');
    console.log('');
    console.log('🔒 Security Features:');
    console.log('   - Server-side answer validation');
    console.log('   - Rate limiting on all endpoints');
    console.log('   - Input sanitization (XSS, NoSQL injection prevention)');
    console.log('   - Suspicious activity detection');
    console.log('   - Latency compensation for fair gameplay');
    console.log('   - Escrow system for wagers');
    console.log('');
    console.log('🔧 Safety Notes:');
    console.log('   - Existing tables are UNTOUCHED');
    console.log('   - Script uses "IF NOT EXISTS" to prevent errors');
    console.log('   - Safe to run multiple times');
    console.log('   - All changes are additive (no data loss)');
    console.log('   - Foreign keys ensure referential integrity');
    console.log('');
    console.log('💡 Troubleshooting:');
    console.log('   - If tables already exist, this is safe to run again');
    console.log('   - Check logs in server.js for initialization errors');
    console.log('   - Verify Redis is running for active users & leaderboards');
    console.log('   - Ensure Socket.io is configured for WebSocket events');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up Quiz Platform:', error.message);
    console.error('\nFull error:', error);
    
    // Provide troubleshooting tips
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure PostgreSQL UUID extension is enabled:');
    console.log('      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    console.log('   2. Check if Users table exists');
    console.log('   3. Verify database connection and permissions');
    console.log('   4. Check if tables already exist');
    console.log('   5. Review error message above for specific issues');
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

setupQuizPlatform();

