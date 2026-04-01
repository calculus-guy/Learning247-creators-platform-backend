const sequelize = require('../config/db');

async function migrateQuizAnswerColumn() {
  try {
    console.log('🔧 Running quiz_match_answers migration...\n');

    // Check current column type
    const [columns] = await sequelize.query(`
      SELECT column_name, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'quiz_match_answers'
      AND column_name = 'selected_answer'
      AND table_schema = 'public';
    `);

    if (columns.length === 0) {
      console.log('❌ Column selected_answer not found in quiz_match_answers');
      process.exit(1);
    }

    const currentLength = columns[0].character_maximum_length;
    console.log(`   Current selected_answer type: VARCHAR(${currentLength})`);

    if (currentLength >= 7) {
      console.log('✅ Column already VARCHAR(7) or larger — no migration needed');
      process.exit(0);
    }

    // Alter the column
    await sequelize.query(`
      ALTER TABLE quiz_match_answers
      ALTER COLUMN selected_answer TYPE VARCHAR(7);
    `);

    console.log('✅ selected_answer column updated to VARCHAR(7)');
    console.log('\n🎉 Migration complete!');
    console.log('Run: pm2 restart backend');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrateQuizAnswerColumn();
