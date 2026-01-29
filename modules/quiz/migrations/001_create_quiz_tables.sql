-- Learning247 Quiz Module Database Migration
-- Version: 001
-- Description: Create quiz tables for user profiles, challenges, and matches
-- Author: Learning247 Development Team
-- Date: 2026-01-25

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create quiz_profiles table
-- This table stores quiz-specific user data and Zeta balance
CREATE TABLE IF NOT EXISTS quiz_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES "Users"(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    avatar_ref TEXT NOT NULL DEFAULT 'lib:avatar_1',
    zeta_balance INTEGER NOT NULL DEFAULT 100,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    last_daily_refill DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Constraints
    CONSTRAINT quiz_profiles_zeta_balance_check CHECK (zeta_balance >= 0),
    CONSTRAINT quiz_profiles_wins_check CHECK (wins >= 0),
    CONSTRAINT quiz_profiles_losses_check CHECK (losses >= 0),
    CONSTRAINT quiz_profiles_nickname_length CHECK (length(nickname) >= 1 AND length(nickname) <= 50),
    CONSTRAINT quiz_profiles_avatar_format CHECK (avatar_ref ~ '^lib:avatar_\d+$')
);

-- Create quiz_challenges table
-- This table stores challenge requests between users
CREATE TABLE IF NOT EXISTS quiz_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenger_id INTEGER NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
    target_id INTEGER NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
    categories TEXT[] NOT NULL,
    wager INTEGER NOT NULL DEFAULT 0,
    wager_enabled BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Constraints
    CONSTRAINT quiz_challenges_valid_status CHECK (status IN ('pending', 'accepted', 'rejected', 'timed_out', 'cancelled')),
    CONSTRAINT quiz_challenges_valid_wager CHECK (wager >= 0),
    CONSTRAINT quiz_challenges_different_users CHECK (challenger_id != target_id),
    CONSTRAINT quiz_challenges_categories_length CHECK (array_length(categories, 1) >= 1 AND array_length(categories, 1) <= 5),
    CONSTRAINT quiz_challenges_expires_after_created CHECK (expires_at > created_at)
);

-- Create quiz_matches table
-- This table stores match results and history
CREATE TABLE IF NOT EXISTS quiz_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_a_id INTEGER NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
    player_b_id INTEGER NOT NULL REFERENCES "Users"(id) ON DELETE CASCADE,
    player_a_score SMALLINT NOT NULL DEFAULT 0,
    player_b_score SMALLINT NOT NULL DEFAULT 0,
    winner_id INTEGER REFERENCES "Users"(id) ON DELETE SET NULL,
    wager INTEGER NOT NULL DEFAULT 0,
    match_type TEXT NOT NULL DEFAULT 'pvp',
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT quiz_matches_valid_scores CHECK (player_a_score >= 0 AND player_b_score >= 0),
    CONSTRAINT quiz_matches_valid_match_type CHECK (match_type IN ('pvp', 'ai_practice')),
    CONSTRAINT quiz_matches_valid_status CHECK (status IN ('in_progress', 'completed', 'aborted')),
    CONSTRAINT quiz_matches_different_players CHECK (player_a_id != player_b_id),
    CONSTRAINT quiz_matches_valid_wager CHECK (wager >= 0),
    CONSTRAINT quiz_matches_winner_is_player CHECK (
        winner_id IS NULL OR winner_id = player_a_id OR winner_id = player_b_id
    ),
    CONSTRAINT quiz_matches_completed_at_after_created CHECK (
        completed_at IS NULL OR completed_at >= created_at
    )
);

-- Create indexes for performance optimization

-- Quiz Profiles indexes
CREATE INDEX IF NOT EXISTS idx_quiz_profiles_zeta_balance ON quiz_profiles(zeta_balance DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_profiles_wins ON quiz_profiles(wins DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_profiles_last_refill ON quiz_profiles(last_daily_refill);

-- Quiz Challenges indexes
CREATE INDEX IF NOT EXISTS idx_quiz_challenges_challenger ON quiz_challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_quiz_challenges_target ON quiz_challenges(target_id);
CREATE INDEX IF NOT EXISTS idx_quiz_challenges_status ON quiz_challenges(status);
CREATE INDEX IF NOT EXISTS idx_quiz_challenges_expires ON quiz_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_quiz_challenges_created ON quiz_challenges(created_at DESC);

-- Composite index for active challenges
CREATE INDEX IF NOT EXISTS idx_quiz_challenges_active ON quiz_challenges(status, expires_at) 
WHERE status = 'pending';

-- Quiz Matches indexes
CREATE INDEX IF NOT EXISTS idx_quiz_matches_player_a ON quiz_matches(player_a_id);
CREATE INDEX IF NOT EXISTS idx_quiz_matches_player_b ON quiz_matches(player_b_id);
CREATE INDEX IF NOT EXISTS idx_quiz_matches_winner ON quiz_matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_quiz_matches_created ON quiz_matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_matches_completed ON quiz_matches(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_matches_type ON quiz_matches(match_type);

-- Composite index for user match history
CREATE INDEX IF NOT EXISTS idx_quiz_matches_user_history ON quiz_matches(player_a_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_matches_user_history_b ON quiz_matches(player_b_id, created_at DESC);

-- Add triggers for updated_at timestamp on quiz_profiles
CREATE OR REPLACE FUNCTION update_quiz_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quiz_profiles_updated_at_trigger
    BEFORE UPDATE ON quiz_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_quiz_profiles_updated_at();

-- Insert default configuration data (if needed)
-- This could include default categories, system settings, etc.

-- Verify tables were created successfully
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('quiz_profiles', 'quiz_challenges', 'quiz_matches');
    
    IF table_count = 3 THEN
        RAISE NOTICE 'Quiz tables created successfully: % tables found', table_count;
    ELSE
        RAISE EXCEPTION 'Quiz table creation failed: only % of 3 tables found', table_count;
    END IF;
END $$;

-- Migration completed successfully
SELECT 'Quiz Module Migration 001 completed successfully' AS migration_status;