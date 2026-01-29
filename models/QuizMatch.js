const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const QuizMatch = sequelize.define('QuizMatch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  player_a_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  player_b_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  player_a_score: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    defaultValue: 0,
  },
  player_b_score: {
    type: DataTypes.SMALLINT,
    allowNull: false,
    defaultValue: 0,
  },
  winner_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  wager: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  match_type: {
    type: DataTypes.ENUM('pvp', 'ai_practice'),
    allowNull: false,
    defaultValue: 'pvp',
  },
  status: {
    type: DataTypes.ENUM('in_progress', 'completed', 'aborted'),
    allowNull: false,
    defaultValue: 'completed',
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  tableName: 'quiz_matches',
  timestamps: false,
});

module.exports = QuizMatch;