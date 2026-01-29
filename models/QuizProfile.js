const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const QuizProfile = sequelize.define('QuizProfile', {
  user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
  },
  nickname: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  avatar_ref: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'lib:avatar_1',
  },
  zeta_balance: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100,
  },
  wins: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  losses: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  last_daily_refill: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  }
}, {
  tableName: 'quiz_profiles',
  timestamps: false,
});

module.exports = QuizProfile;