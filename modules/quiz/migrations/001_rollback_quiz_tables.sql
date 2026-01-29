-- Learning247 Quiz Module Database Rollback
-- Version: 001
-- Description: Rollback quiz tables and related objects
-- Author: Learning247 Development Team
-- Date: 2026-01-25

-- This script safely removes all quiz module database objects
-- It can be run multiple times without errors

-- Drop triggers first
DROP TRIGGER IF EXISTS quiz_profiles_updated_at_trigger ON quiz_profiles;
DROP FUNCTION IF EXISTS update_quiz_profiles_updated_at();

-- Drop indexes (they will be dropped automatically with tables, but explicit for clarity)
DROP INDEX IF EXISTS idx_quiz_profiles_zeta_balance;
DROP INDEX IF EXISTS idx_quiz_profiles_wins;
DROP INDEX IF EXISTS idx_quiz_profiles_last_refill;

DROP INDEX IF EXISTS idx_quiz_challenges_challenger;
DROP INDEX IF EXISTS idx_quiz_challenges_target;
DROP INDEX IF EXISTS idx_quiz_challenges_status;
DROP INDEX IF EXISTS idx_quiz_challenges_expires;
DROP INDEX IF EXISTS idx_quiz_challenges_created;
DROP INDEX IF EXISTS idx_quiz_challenges_active;

DROP INDEX IF EXISTS idx_quiz_matches_player_a;
DROP INDEX IF EXISTS idx_quiz_matches_player_b;
DROP INDEX IF EXISTS idx_quiz_matches_winner;
DROP INDEX IF EXISTS idx_quiz_matches_created;
DROP INDEX IF EXISTS idx_quiz_matches_completed;
DROP INDEX IF EXISTS idx_quiz_matches_type;
DROP INDEX IF EXISTS idx_quiz_matches_user_history;
DROP INDEX IF EXISTS idx_quiz_matches_user_history_b;

-- Drop tables in reverse dependency order
-- quiz_matches references Users but not other quiz tables
DROP TABLE IF EXISTS quiz_matches CASCADE;

-- quiz_challenges references Users but not other quiz tables  
DROP TABLE IF EXISTS quiz_challenges CASCADE;

-- quiz_profiles references Users
DROP TABLE IF EXISTS quiz_profiles CASCADE;

-- Verify tables were dropped successfully
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('quiz_profiles', 'quiz_challenges', 'quiz_matches');
    
    IF table_count = 0 THEN
        RAISE NOTICE 'Quiz tables dropped successfully: % tables remaining', table_count;
    ELSE
        RAISE WARNING 'Quiz table rollback incomplete: % tables still exist', table_count;
    END IF;
END $$;

-- Note: We don't drop the UUID extension as it might be used by other parts of the system
-- If you need to drop it, uncomment the following line:
-- DROP EXTENSION IF EXISTS "uuid-ossp";

-- Rollback completed
SELECT 'Quiz Module Rollback 001 completed successfully' AS rollback_status;