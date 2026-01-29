const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const QuizChallenge = sequelize.define('QuizChallenge', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  challenger_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  target_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  categories: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
  },
  wager: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  wager_enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'timed_out', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  }
}, {
  tableName: 'quiz_challenges',
  timestamps: false,
});

module.exports = QuizChallenge;